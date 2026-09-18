#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <stddef.h>
#include <wchar.h>

/* ArcDPS API reviewed 2026-09-10. Raw cbtevent revision 1 is 64 bytes.
 * No interpretation of its overloaded fields happens on the callback thread. */
typedef struct { const char *name; uintptr_t id; uint32_t prof, elite, self; uint16_t team; } ArcAgent;
typedef struct {
    uint64_t size; uint32_t sig, imguivers; const char *out_name, *out_build;
    void *wnd_nofilter, *combat, *imgui, *options_tab, *combat_local, *wnd_filter, *options_windows;
} ArcExports;
_Static_assert(sizeof(void *) == 8, "ArcDPS requires a 64-bit build");
_Static_assert(sizeof(ArcAgent) == 32, "Unexpected agent ABI");
_Static_assert(sizeof(ArcExports) == 88, "Unexpected exports ABI");

enum { CAPACITY = 4096, NAME_BYTES = 192, FILE_LIMIT = 128 * 1024 * 1024 };
typedef struct { uint64_t id; uint32_t prof, elite, self; uint16_t team; uint8_t present, truncated; char name[NAME_BYTES]; } AgentCopy;
typedef struct {
    uint64_t sequence, arc_id, revision, received_tick;
    uint8_t local, has_event, raw[64]; AgentCopy src, dst;
} Capture;
typedef struct DECLSPEC_ALIGN(MEMORY_ALLOCATION_ALIGNMENT) { SLIST_ENTRY link; Capture item; } CaptureSlot;
static CaptureSlot slots[CAPACITY];
static SLIST_HEADER free_slots, pending_slots;
/* Only the consumer accesses this detached batch. */
static PSLIST_ENTRY consumer_batch;
static volatile LONG accepting;
static volatile LONG active_callbacks;
static volatile LONG64 attempted, dropped, unsupported, capacity_dropped, shutdown_dropped;
static HANDLE writer_thread;
static FILE *output;
static ArcExports exports;
static char arc_version[96];
static wchar_t capture_base[2304];
static unsigned segment_index;
static long segment_limit = FILE_LIMIT;
static unsigned segment_max = 16;

static int open_segment(void) {
    wchar_t path[2400];
    _snwprintf(path, 2400, L"%ls-part%03u.jsonl", capture_base, segment_index);
    output = _wfopen(path, L"wx");
    if (!output) return 0;
    fprintf(output, "{\"type\":\"header\",\"format\":\"entropy-arc-callbacks\",\"version\":1,\"collectorVersion\":\"0.1.2\",\"segment\":%u,\"sessionId\":\"", segment_index);
    /* ASCII filename stem is generated locally, never supplied by the game. */
    const wchar_t *stem = wcsrchr(capture_base, L'\\');
    for (const wchar_t *p = stem ? stem + 1 : capture_base; *p; ++p) fputc((char)*p, output);
    fputs("\",\"arcVersionHex\":\"", output);
    const unsigned char *version = (const unsigned char *)arc_version;
    while (*version) fprintf(output, "%02x", *version++);
    fputs("\",\"clock\":\"raw callback plus local receipt tick; not encounter-relative\"}\n", output);
    if (fflush(output)) { fclose(output); output = NULL; return 0; }
    return 1;
}

static int close_segment(uint64_t written, uint64_t session_written, uint64_t discarded, int capped, int failed, int continued) {
    fprintf(output, "{\"type\":\"end\",\"scope\":\"segment\",\"written\":%llu,\"continued\":%s,\"sessionAttempted\":%llu,\"sessionWritten\":%llu,\"queueDropped\":%llu,\"capacityDropped\":%llu,\"shutdownDropped\":%llu,\"unsupportedRevision\":%llu,\"writerDiscarded\":%llu,\"sizeLimited\":%s,\"writeFailed\":%s}\n",
        (unsigned long long)written, continued ? "true" : "false", (unsigned long long)InterlockedCompareExchange64(&attempted, 0, 0),
        (unsigned long long)session_written, (unsigned long long)InterlockedCompareExchange64(&dropped, 0, 0),
        (unsigned long long)InterlockedCompareExchange64(&capacity_dropped, 0, 0), (unsigned long long)InterlockedCompareExchange64(&shutdown_dropped, 0, 0),
        (unsigned long long)InterlockedCompareExchange64(&unsupported, 0, 0), (unsigned long long)discarded, capped ? "true" : "false", failed ? "true" : "false");
    int error = ferror(output);
    if (fclose(output)) error = 1;
    output = NULL;
    return !error;
}

static void reset_queue(void) {
    InitializeSListHead(&free_slots); InitializeSListHead(&pending_slots);
    consumer_batch = NULL;
    for (size_t i = 0; i < CAPACITY; ++i) InterlockedPushEntrySList(&free_slots, &slots[i].link);
    attempted = dropped = unsupported = capacity_dropped = shutdown_dropped = 0;
}

static void copy_agent(AgentCopy *to, const ArcAgent *from) {
    if (!from) return;
    to->present = 1; to->id = from->id; to->prof = from->prof;
    to->elite = from->elite; to->self = from->self; to->team = from->team;
    if (!from->name) return;
    size_t i = 0;
    for (; i < NAME_BYTES - 1 && from->name[i]; ++i) to->name[i] = from->name[i];
    to->truncated = i == NAME_BYTES - 1;
}

static void capture_inner(void *event, ArcAgent *src, ArcAgent *dst, uint64_t id, uint64_t revision, uint8_t local) {
    if (!InterlockedCompareExchange(&accepting, 0, 0)) return;
    const uint64_t sequence = (uint64_t)InterlockedIncrement64(&attempted);
    if (event && revision != 1) { InterlockedIncrement64(&unsupported); return; }
    Capture item = {0};
    item.sequence = sequence; item.arc_id = id; item.revision = revision;
    item.received_tick = GetTickCount64(); item.local = local; item.has_event = event != NULL;
    if (event) memcpy(item.raw, event, sizeof item.raw);
    copy_agent(&item.src, src); copy_agent(&item.dst, dst);
    if (!InterlockedCompareExchange(&accepting, 0, 0)) {
        InterlockedIncrement64(&shutdown_dropped); InterlockedIncrement64(&dropped); return;
    }
    PSLIST_ENTRY entry = InterlockedPopEntrySList(&free_slots);
    if (!entry) { InterlockedIncrement64(&capacity_dropped); InterlockedIncrement64(&dropped); return; }
    CaptureSlot *slot = CONTAINING_RECORD(entry, CaptureSlot, link);
    slot->item = item;
    InterlockedPushEntrySList(&pending_slots, entry);
}

static void capture(void *event, ArcAgent *src, ArcAgent *dst, uint64_t id, uint64_t revision, uint8_t local) {
    InterlockedIncrement(&active_callbacks);
    capture_inner(event, src, dst, id, revision, local);
    InterlockedDecrement(&active_callbacks);
}

static void area(void *ev, ArcAgent *src, ArcAgent *dst, const char *skill, uint64_t id, uint64_t revision) {
    (void)skill; capture(ev, src, dst, id, revision, 0);
}
static void local(void *ev, ArcAgent *src, ArcAgent *dst, const char *skill, uint64_t id, uint64_t revision) {
    (void)skill; capture(ev, src, dst, id, revision, 1);
}
static int pop(Capture *item) {
    if (!consumer_batch) {
        PSLIST_ENTRY batch = InterlockedFlushSList(&pending_slots);
        // Reverse the detached stack to preserve publication order within a batch.
        while (batch) { PSLIST_ENTRY next = batch->Next; batch->Next = consumer_batch; consumer_batch = batch; batch = next; }
    }
    if (!consumer_batch) return 0;
    PSLIST_ENTRY entry = consumer_batch; consumer_batch = entry->Next;
    *item = CONTAINING_RECORD(entry, CaptureSlot, link)->item;
    InterlockedPushEntrySList(&free_slots, entry);
    return 1;
}
static void hex(FILE *file, const void *bytes, size_t length) {
    const unsigned char *p = bytes;
    for (size_t i = 0; i < length; ++i) fprintf(file, "%02x", p[i]);
}
static void agent_json(FILE *file, const AgentCopy *a) {
    if (!a->present) { fputs("null", file); return; }
    fprintf(file, "{\"id\":\"%llu\",\"profession\":%u,\"elite\":%u,\"self\":%u,\"team\":%u,\"nameTruncated\":%s,\"nameUtf8Hex\":\"",
        (unsigned long long)a->id, a->prof, a->elite, a->self, a->team, a->truncated ? "true" : "false");
    hex(file, a->name, strlen(a->name)); fputs("\"}", file);
}
static DWORD WINAPI writer(void *unused) {
    (void)unused;
    Capture item; uint64_t written = 0, segment_written = 0, discarded = 0; int capped = 0, failed = 0;
    for (;;) {
        if (pop(&item)) {
            if (capped || failed) { ++discarded; continue; }
            const long position = ftell(output);
            if (position < 0) { failed = 1; ++discarded; continue; }
            if (position >= segment_limit) {
                if (segment_index >= segment_max) { capped = 1; ++discarded; continue; }
                if (!close_segment(segment_written, written, discarded, 0, 0, 1)) { failed = 1; ++discarded; continue; }
                ++segment_index; segment_written = 0;
                if (!open_segment()) { failed = 1; ++discarded; continue; }
            }
            fprintf(output, "{\"type\":\"callback\",\"sequence\":\"%llu\",\"arcId\":\"%llu\",\"revision\":%llu,\"receivedTickMs\":\"%llu\",\"stream\":\"%s\",\"rawHex\":",
                (unsigned long long)item.sequence, (unsigned long long)item.arc_id, (unsigned long long)item.revision,
                (unsigned long long)item.received_tick, item.local ? "local" : "area");
            if (item.has_event) { fputc('"', output); hex(output, item.raw, 64); fputc('"', output); }
            else fputs("null", output);
            fputs(",\"src\":", output); agent_json(output, &item.src);
            fputs(",\"dst\":", output); agent_json(output, &item.dst); fputs("}\n", output);
            if (ferror(output)) { failed = 1; ++discarded; } else { ++written; ++segment_written; }
        } else {
            if (!InterlockedCompareExchange(&accepting, 0, 0) && !InterlockedCompareExchange(&active_callbacks, 0, 0)) {
                /* Recheck after producers finish; an earlier empty pop may race publication. */
                if (QueryDepthSList(&pending_slots) == 0) break;
                continue;
            }
            if (output && fflush(output)) failed = 1;
            Sleep(10);
        }
    }
    if (output) close_segment(segment_written, written, discarded, capped, failed, 0);
    return 0;
}
static void fail(const char *message) { exports.sig = 0; exports.size = (uint64_t)(uintptr_t)message; }
static void *initialize(void) {
    reset_queue();
    wchar_t dir[2048];
    DWORD size = GetEnvironmentVariableW(L"ENTROPY_CAPTURE_DIR", dir, 2048);
    if (!size || size >= 2048) { fail("Entropy prototype: set ENTROPY_CAPTURE_DIR to an existing output directory to opt in."); return &exports; }
    SYSTEMTIME now; GetSystemTime(&now);
    _snwprintf(capture_base, 2304, L"%ls\\entropy-%04u%02u%02u-%02u%02u%02u-%u-%llu", dir,
        now.wYear, now.wMonth, now.wDay, now.wHour, now.wMinute, now.wSecond, GetCurrentProcessId(), (unsigned long long)GetTickCount64());
    segment_index = 1;
    if (!open_segment()) { fail("Entropy prototype: cannot create capture segment."); return &exports; }
    accepting = 1;
    writer_thread = CreateThread(NULL, 0, writer, NULL, 0, NULL);
    if (!writer_thread) { accepting = 0; fclose(output); output = NULL; fail("Entropy prototype: cannot start writer."); }
    return &exports;
}
static void shutdown_capture(void) {
    /* ArcDPS stops new dispatch before release; finish callbacks already entered. */
    InterlockedExchange(&accepting, 0);
    while (InterlockedCompareExchange(&active_callbacks, 0, 0)) Sleep(1);
    if (writer_thread) { WaitForSingleObject(writer_thread, INFINITE); CloseHandle(writer_thread); writer_thread = NULL; }
}
__declspec(dllexport) void *get_init_addr(char *version, void *imgui, void *d3d, HANDLE arc, void *alloc, void *freefn, uint32_t imgui_version) {
    (void)imgui; (void)d3d; (void)arc; (void)alloc; (void)freefn;
    if (version) { strncpy(arc_version, version, sizeof arc_version - 1); arc_version[sizeof arc_version - 1] = 0; }
    exports = (ArcExports){0}; exports.size = sizeof exports;
    exports.sig = 0x45545031; /* Prototype signature: collision check required before release. */
    exports.imguivers = imgui_version; exports.out_name = "Entropy Capture Prototype"; exports.out_build = "0.1.2";
    exports.combat = (void *)area; exports.combat_local = (void *)local;
    return (void *)initialize;
}
__declspec(dllexport) void *get_release_addr(uint32_t reason) { (void)reason; return (void *)shutdown_capture; }
