import { useMemo, useState } from "react";

interface DataTableProps<T extends Record<string, unknown>> {
  rows: T[];
  columns: Array<{ key: keyof T; label: string }>;
  empty: string;
}

export function DataTable<T extends Record<string, unknown>>({ rows, columns, empty }: DataTableProps<T>) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<keyof T>(columns[0]?.key);
  const filtered = useMemo(() => {
    const lowered = filter.toLowerCase();
    return rows
      .filter((row) => JSON.stringify(row).toLowerCase().includes(lowered))
      .sort((left, right) => String(left[sortKey] ?? "").localeCompare(String(right[sortKey] ?? "")));
  }, [filter, rows, sortKey]);

  return (
    <div className="data-table-shell">
      <div className="table-toolbar">
        <input placeholder="Filter" value={filter} onChange={(event) => setFilter(event.target.value)} />
        <span>{filtered.length} rows</span>
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state">{empty}</div>
      ) : (
        <div className="data-table">
          <div className="table-head" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(140px, 1fr))` }}>
            {columns.map((column) => (
              <button type="button" key={String(column.key)} onClick={() => setSortKey(column.key)}>
                {column.label}
              </button>
            ))}
          </div>
          {filtered.slice(0, 50).map((row, index) => (
            <div
              className="table-row"
              key={index}
              style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(140px, 1fr))` }}
            >
              {columns.map((column) => (
                <span key={String(column.key)}>{formatCell(row[column.key])}</span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
