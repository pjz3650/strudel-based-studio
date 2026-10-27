import { it, expect, vi, afterEach } from 'vitest';
vi.mock('@strudel/midi', () => ({
  WebMidi: { enable: vi.fn(async () => {}), disable: vi.fn(async () => {}) },
}));
import { MidiController } from '../../src/midi/controller';
import { StudioState } from '../../src/state';
afterEach(() => vi.unstubAllGlobals());
function deviceFixture() {
  const output = {
    id: 'out1',
    name: 'Virtual Out',
    state: 'connected',
    send: vi.fn(),
    clear: vi.fn(),
    open: vi.fn(async () => {}),
  };
  const input = { id: 'in1', name: 'Controller', state: 'connected', onmidimessage: null as any };
  const access = {
    inputs: new Map([['in1', input]]),
    outputs: new Map([['out1', output]]),
    onstatechange: null as any,
  };
  vi.stubGlobal('navigator', { requestMIDIAccess: vi.fn(async () => access) });
  const state = new StudioState(),
    apply = vi.fn();
  state.modify = vi.fn();
  state.preference = vi.fn();
  const controller = new MidiController(state, apply);
  return { state, controller, apply, input, output, access };
}
it('detecta dispositivos, aprende CC e aplica a associação', async () => {
  const f = deviceFixture();
  await f.controller.connect();
  expect(f.controller.outputs[0].name).toBe('Virtual Out');
  f.controller.learning = 'lpf';
  f.input.onmidimessage({ data: new Uint8Array([0xb1, 74, 127]) });
  expect(f.state.project.midi.mappings).toEqual([{ input: 'Controller', channel: 1, cc: 74, target: 'lpf' }]);
  expect(f.state.project.parameters.lpf).toBe(20000);
  expect(f.apply).toHaveBeenCalled();
  expect(f.controller.learning).toBeNull();
});
it('aplica somente a entrada selecionada e informa desconexão/reconexão', async () => {
  const f = deviceFixture();
  await f.controller.connect();
  f.state.project.midi.input = 'Outro';
  f.controller.learning = 'pan';
  f.input.onmidimessage({ data: new Uint8Array([0xb0, 10, 64]) });
  expect(f.state.project.midi.mappings).toEqual([]);
  f.state.project.midi.output = 'Virtual Out';
  f.access.outputs.clear();
  f.access.onstatechange();
  expect(f.state.logs.at(-1)?.message).toContain('indisponível');
  f.access.outputs.set('out1', f.output);
  f.access.onstatechange();
  expect(f.controller.outputs).toHaveLength(1);
});
it('envia Note On/Off e CC, limpa a fila e encerra notas ao parar', async () => {
  const f = deviceFixture();
  await f.controller.connect();
  f.state.project.midi.output = 'Virtual Out';
  f.state.project.midi.channel = 3;
  await f.controller.testNote();
  expect(f.output.send.mock.calls[0][0]).toEqual([0x92, 60, 80]);
  expect(f.output.send.mock.calls[1][0]).toEqual([0x82, 60, 0]);
  f.controller.sendCC(74, 90);
  expect(f.output.send).toHaveBeenLastCalledWith([0xb2, 74, 90]);
  expect(() => f.controller.sendCC(128, -1)).toThrow();
  f.controller.panic();
  expect(f.output.clear).toHaveBeenCalled();
  expect(f.output.send).toHaveBeenCalledWith([0xbf, 123, 0]);
  f.controller.dispose();
  expect(f.input.onmidimessage).toBeNull();
});
it('apresenta falhas de permissão sem simular dispositivos', async () => {
  const f = deviceFixture();
  vi.stubGlobal('navigator', {
    requestMIDIAccess: vi.fn(async () => {
      throw new Error('Access denied');
    }),
  });
  await expect(f.controller.connect()).rejects.toThrow('Access denied');
  expect(f.controller.outputs).toEqual([]);
});
