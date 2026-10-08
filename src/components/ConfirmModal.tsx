export function ConfirmModal({ title, body, cancelLabel, confirmLabel, onCancel, onConfirm, children }: { title: string; body: string; cancelLabel: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void; children?: React.ReactNode }) {
  return <div className="modalWrap"><div className="modal"><h3>{title}</h3><p className="subtle">{body}</p>{children}<div className="btnRow"><button className="btn btnSecondary" onClick={onCancel}>{cancelLabel}</button><button className="btn btnPrimary" onClick={onConfirm}>{confirmLabel}</button></div></div></div>;
}
