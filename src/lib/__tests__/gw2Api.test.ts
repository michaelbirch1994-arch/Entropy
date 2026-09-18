import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it('keeps valid skill references when one recorded id is rejected by the API', async () => {
  const request = vi.fn(async (input: string | URL | Request) => {
    const ids = new URL(String(input)).searchParams.get('ids')!.split(',').map(Number);
    if (ids.includes(999999)) return { ok: false, status: ids.length === 1 ? 404 : 400 };
    return { ok: true, status: 200, json: async () => ids.map(id => ({ id, name: `Skill ${id}`, slot: 'Utility' })) };
  });
  vi.stubGlobal('fetch', request);
  const { fetchGw2Skills } = await import('../gw2/gw2Api');

  const skills = await fetchGw2Skills([1, 999999, 2]);

  expect(skills.map(skill => skill.id)).toEqual([1, 2]);
  expect(request).toHaveBeenCalledTimes(5);
});

it('keeps skill references when the API omits an optional slot field', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => [
      { id: 13677, name: 'Lesser Symbol of Resolution', description: 'Symbol.' },
      { id: 9091, name: 'Shield of Absorption', slot: 'Weapon_5', description: 'Protect allies.' },
    ],
  })));
  const { fetchGw2Skills } = await import('../gw2/gw2Api');

  const skills = await fetchGw2Skills([13677, 9091]);

  expect(skills.map(skill => skill.id)).toEqual([13677, 9091]);
});
