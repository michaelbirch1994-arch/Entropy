#ifdef NDEBUG
#undef NDEBUG
#endif
#include <assert.h>
#include "collector.c"

static DWORD WINAPI producer(void *arg) {
    const uintptr_t stream = (uintptr_t)arg;
    unsigned char bytes[64] = {0}; bytes[0] = 42;
    for (unsigned i = 0; i < 10000; ++i) capture(bytes, NULL, NULL, i, 1, (uint8_t)stream);
    return 0;
}
static DWORD WINAPI small_producer(void *arg) {
    unsigned char bytes[64] = {0};
    for (unsigned i = 0; i < 1000; ++i) capture(bytes, NULL, NULL, i, 1, (uint8_t)(uintptr_t)arg);
    return 0;
}
int main(int argc, char **argv) {
    Capture item;
    unsigned char bytes[64] = {0}; bytes[3] = 99;
    ArcAgent source = {"Example", 123, 1, 2, 1, 3};
    reset_queue();
    accepting = 1;
    capture(bytes, &source, NULL, 9, 1, 1);
    bytes[3] = 0;
    assert(pop(&item) && item.raw[3] == 99 && item.local == 1 && item.src.id == 123);
    assert(strcmp(item.src.name, "Example") == 0);
    capture(NULL, &source, NULL, 0, 99, 0);
    assert(pop(&item) && !item.has_event);
    capture(bytes, NULL, NULL, 0, 2, 0);
    assert(unsupported == 1 && !pop(&item));
    for (int i = 0; i < CAPACITY + 3; ++i) capture(bytes, NULL, NULL, i, 1, 0);
    assert(QueryDepthSList(&pending_slots) == CAPACITY && dropped == 3 && capacity_dropped == 3);
    while (pop(&item)) {}
    attempted = dropped = unsupported = 0;
    HANDLE a = CreateThread(NULL, 0, producer, (void *)0, 0, NULL);
    HANDLE b = CreateThread(NULL, 0, producer, (void *)1, 0, NULL);
    assert(a && b); WaitForSingleObject(a, INFINITE); WaitForSingleObject(b, INFINITE);
    CloseHandle(a); CloseHandle(b);
    assert(attempted == 20000 && (uint64_t)QueryDepthSList(&pending_slots) + dropped == 20000);
    while (pop(&item)) {}
    /* Two concurrent producers below capacity must lose nothing to contention. */
    reset_queue();
    a = CreateThread(NULL, 0, small_producer, (void *)0, 0, NULL);
    b = CreateThread(NULL, 0, small_producer, (void *)1, 0, NULL);
    assert(a && b); WaitForSingleObject(a, INFINITE); WaitForSingleObject(b, INFINITE);
    CloseHandle(a); CloseHandle(b);
    assert(attempted == 2000 && dropped == 0);
    unsigned char seen[2001] = {0}; unsigned drained = 0;
    while (pop(&item)) { assert(item.sequence > 0 && item.sequence <= 2000 && !seen[item.sequence]); seen[item.sequence] = 1; ++drained; }
    assert(drained == 2000 && QueryDepthSList(&free_slots) == CAPACITY);
    reset_queue();
    a = CreateThread(NULL, 0, producer, (void *)0, 0, NULL);
    b = CreateThread(NULL, 0, producer, (void *)1, 0, NULL);
    assert(a && b);
    unsigned char concurrent_seen[20001] = {0}; drained = 0;
    for (;;) {
        if (pop(&item)) {
            assert(item.sequence > 0 && item.sequence <= 20000 && !concurrent_seen[item.sequence]);
            concurrent_seen[item.sequence] = 1; ++drained;
        } else if (WaitForSingleObject(a, 0) == WAIT_OBJECT_0 && WaitForSingleObject(b, 0) == WAIT_OBJECT_0) {
            if (QueryDepthSList(&pending_slots) == 0) break;
        } else SwitchToThread();
    }
    CloseHandle(a); CloseHandle(b);
    assert(drained + dropped == 20000 && dropped == capacity_dropped && shutdown_dropped == 0);
    assert(QueryDepthSList(&free_slots) == CAPACITY);
    printf("Concurrent drain: %u retained, %llu capacity drops, no duplicate sequences.\n", drained, (unsigned long long)dropped);
    accepting = 0;
    get_init_addr("synthetic-test", NULL, NULL, NULL, NULL, NULL, 19270);
    initialize(); assert(exports.sig != 0 && writer_thread);
    capture(bytes, &source, NULL, 10, 1, 0);
    capture(bytes, &source, NULL, 11, 1, 1);
    shutdown_capture(); assert(!writer_thread && !output);
    /* Force rotation and budget exhaustion without writing gigabytes. */
    Sleep(2);
    segment_limit = 1; segment_max = 3;
    initialize(); assert(exports.sig != 0 && writer_thread);
    for (unsigned i = 0; i < 5; ++i) capture(bytes, &source, NULL, i, 1, 0);
    shutdown_capture(); assert(!output && segment_index == 3);
    segment_limit = FILE_LIMIT; segment_max = 16;
    /* A successful continuation must retain every callback across files. */
    Sleep(2);
    segment_limit = 1; segment_max = 4;
    initialize(); assert(exports.sig != 0 && writer_thread);
    for (unsigned i = 0; i < 2; ++i) capture(bytes, &source, NULL, i, 1, 0);
    shutdown_capture(); assert(!output && segment_index == 3);
    segment_limit = FILE_LIMIT; segment_max = 16;
    if (argc == 2) {
        HMODULE module = LoadLibraryA(argv[1]); assert(module);
        assert(GetProcAddress(module, "get_init_addr"));
        assert(GetProcAddress(module, "get_release_addr"));
        assert(FreeLibrary(module));
    }
    puts("Native collector tests passed: copy, metadata, revision, overflow, concurrent callbacks, writer shutdown.");
    return 0;
}
