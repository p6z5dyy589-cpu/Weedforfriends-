interface Props {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function StatusMessage({ text, actionLabel, onAction }: Props) {
  return (
    <div role="status" className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg">{text}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="min-h-11 rounded-lg bg-brand px-5 font-medium text-white">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
