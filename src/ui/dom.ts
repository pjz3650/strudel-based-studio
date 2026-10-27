import { createIcons, icons } from 'lucide';
export function refreshIcons() { createIcons({ icons, attrs: { 'stroke-width': 1.5 } }); }
export function icon(name: string): string { return `<i data-lucide="${name}" aria-hidden="true"></i>`; }
export function escape(value: string): string { return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)); }
export function $<T extends HTMLElement = HTMLElement>(selector: string): T { const element = document.querySelector<T>(selector); if (!element) throw new Error(`Elemento ausente: ${selector}`); return element; }
export function button(label: string, glyph: string, action: string, className = '') { return `<button class="${className}" data-action="${action}" title="${label}" aria-label="${label}">${icon(glyph)}</button>`; }
export function field(label: string, input: string, help = '') { return `<label class="field"><span>${label}</span>${input}${help ? `<span class="help">${help}</span>` : ''}</label>`; }
export function modal(title: string, body: string, footer = '<button data-dialog="close">Fechar</button>'): HTMLDialogElement {
  const dialog = document.createElement('dialog'); dialog.className = 'dialog';
  dialog.innerHTML = `<header><h2>${escape(title)}</h2><button data-dialog="close" aria-label="Fechar">${icon('x')}</button></header><div class="dialog-body">${body}</div><footer>${footer}</footer>`;
  document.body.append(dialog); refreshIcons(); dialog.showModal();
  dialog.querySelectorAll('[data-dialog="close"]').forEach(b => b.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', () => dialog.remove(), { once: true }); return dialog;
}
export async function askText(title: string, label: string, value = ''): Promise<string | null> {
  const dialog = modal(title, field(label, `<input id="text-value" required maxlength="128" value="${escape(value)}">`), '<button data-answer="cancel">Cancelar</button><button class="primary" data-answer="accept">Confirmar</button>');
  const input = dialog.querySelector<HTMLInputElement>('input')!; input.focus(); input.select();
  return new Promise(resolve => {
    let answer: string | null = null;
    const accept = () => { if (input.value.trim()) { answer = input.value.trim(); dialog.close(); } else input.reportValidity(); };
    dialog.querySelector('[data-answer="accept"]')!.addEventListener('click', accept);
    dialog.querySelector('[data-answer="cancel"]')!.addEventListener('click', () => dialog.close());
    input.addEventListener('keydown', e => { if (e.key === 'Enter') accept(); });
    dialog.addEventListener('close', () => resolve(answer), { once: true });
  });
}
export function confirmChanges(): Promise<'save' | 'discard' | 'cancel'> {
  const dialog = modal('Salvar alterações?', '<p>Esta sessão tem alterações não salvas. Salve o projeto antes de continuar.</p>', '<button data-choice="cancel">Cancelar</button><button data-choice="discard">Descartar alterações</button><button class="primary" data-choice="save">Salvar projeto</button>');
  return new Promise(resolve => { let choice: 'save' | 'discard' | 'cancel' = 'cancel'; dialog.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(b => b.addEventListener('click', () => { choice = b.dataset.choice as typeof choice; dialog.close(); })); dialog.addEventListener('close', () => resolve(choice), { once: true }); });
}
