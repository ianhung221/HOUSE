import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import Icon from './Icon';

export default function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => { element?.close(); }; }, []);
  return <dialog ref={dialog} className={`modal${wide ? ' wide' : ''}`} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }} aria-label={title}>
    <header className="modal-header"><h2>{title}</h2><button type="button" className="icon-button" aria-label="關閉對話框" onClick={onClose}><Icon name="close" /></button></header>{children}
  </dialog>;
}
