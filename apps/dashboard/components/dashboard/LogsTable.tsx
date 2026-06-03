interface LogEntry {
  id: string;
  type: string;
  message: string;
  source: string;
  timestamp: string;
}

interface LogsTableProps {
  logs: LogEntry[];
}

export function LogsTable({ logs }: LogsTableProps) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-950/80 p-4 shadow-glow backdrop-blur-xl">
      <table className="min-w-full text-left text-sm text-slate-300">
        <thead>
          <tr className="border-b border-slate-800 text-slate-400">
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Mensagem</th>
            <th className="px-4 py-3">Origem</th>
            <th className="px-4 py-3">Data</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-slate-800 last:border-none">
              <td className="px-4 py-4 font-medium text-slate-100">{log.type}</td>
              <td className="px-4 py-4">{log.message}</td>
              <td className="px-4 py-4">{log.source}</td>
              <td className="px-4 py-4 text-slate-400">{log.timestamp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
