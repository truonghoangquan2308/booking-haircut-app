export default function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-8 space-y-2">
      <h1 className="text-3xl font-bold" style={{ color: "var(--color-text-primary)" }}>
        {title}
      </h1>
      {subtitle && (
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
