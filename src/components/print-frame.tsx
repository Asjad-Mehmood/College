/**
 * Page spacing for multi-page printouts. Pages print with zero margin (so the
 * browser adds no title, link or date in the margins); this table repeats an
 * empty band at the top and bottom of every printed page instead.
 */
export function PrintFrame({ top = "14mm", bottom = "14mm", children }: { top?: string; bottom?: string; children: React.ReactNode }) {
  return (
    <table className="w-full border-collapse">
      <thead className="hidden print:table-header-group">
        <tr>
          <td style={{ height: top, padding: 0 }} />
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={{ padding: 0 }}>{children}</td>
        </tr>
      </tbody>
      <tfoot className="hidden print:table-footer-group">
        <tr>
          <td style={{ height: bottom, padding: 0 }} />
        </tr>
      </tfoot>
    </table>
  );
}
