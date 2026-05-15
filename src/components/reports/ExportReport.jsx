import { useState, useEffect } from 'react';
import { Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../shared/LoadingSpinner';
import GlassModal from '../shared/GlassModal';

const NAVY = { r: 7, g: 13, b: 28 };
const CYAN = { r: 0, g: 212, b: 255 };

export default function ExportReport({ open, onClose }) {
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setError(null);
    }
  }, [open]);

  const monthStart = () => {
    const [y, m] = month.split('-').map(Number);
    return startOfMonth(new Date(y, m - 1));
  };

  const loadPreview = async () => {
    setError(null);
    const start = monthStart();
    const end = endOfMonth(start);

    const { data: complaints, error: cErr } = await supabase
      .from('complaints')
      .select('id, dept, status, is_chronic')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    const { data: perf, error: pErr } = await supabase
      .from('dept_performance')
      .select('*')
      .eq('month', format(start, 'yyyy-MM-dd'));

    if (cErr || pErr) {
      setError(cErr?.message || pErr?.message || 'Failed to load report data');
      return;
    }

    const total = complaints?.length || 0;
    const resolved =
      complaints?.filter((c) => ['resolved', 'closed'].includes(c.status)).length || 0;

    const byDept = {};
    (complaints || []).forEach((c) => {
      byDept[c.dept] = (byDept[c.dept] || 0) + 1;
    });

    setPreview({
      total,
      resolved,
      resolutionRate: total ? Math.round((resolved / total) * 100) : 0,
      deptRows: perf?.length
        ? perf
        : Object.entries(byDept).map(([dept, count]) => ({
            dept,
            total_complaints: count,
          })),
    });
  };

  const generatePdf = async () => {
    setGenerating(true);
    setError(null);
    try {
      const start = monthStart();
      const end = endOfMonth(start);
      const monthLabel = format(start, 'MMMM yyyy');

      const { data: complaints } = await supabase
        .from('complaints')
        .select('id, dept, status, severity, ward_id, is_chronic, created_at, wards(name)')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      const { data: perf } = await supabase
        .from('dept_performance')
        .select('*')
        .eq('month', format(start, 'yyyy-MM-dd'));

      const { data: wards } = await supabase.from('wards').select('name, zone, health_score');

      const total = complaints?.length || 0;
      const resolved =
        complaints?.filter((c) => ['resolved', 'closed'].includes(c.status)).length || 0;
      const openCount = complaints?.filter((c) =>
        ['open', 'assigned', 'in_progress', 'reopened'].includes(c.status)
      ).length;
      const chronic = complaints?.filter((c) => c.is_chronic).length || 0;

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text('NagarRakshak — GHMC', 14, 18);
      doc.setFontSize(12);
      doc.setTextColor(CYAN.r, CYAN.g, CYAN.b);
      doc.text(`Monthly Civic Report — ${monthLabel}`, 14, 28);
      doc.setTextColor(200, 200, 200);
      doc.setFontSize(9);
      doc.text(`Generated ${format(new Date(), 'd MMM yyyy, h:mm a')}`, 14, 35);

      doc.setTextColor(30, 30, 30);
      let yPos = 50;
      doc.setFontSize(11);
      doc.text('Executive Summary', 14, yPos);
      yPos += 8;
      doc.setFontSize(10);
      [
        `Total complaints filed: ${total}`,
        `Resolved / closed: ${resolved} (${total ? Math.round((resolved / total) * 100) : 0}%)`,
        `Currently open: ${openCount}`,
        `Chronic hotspots flagged: ${chronic}`,
        `Wards monitored: ${wards?.length || 0}`,
      ].forEach((line) => {
        doc.text(line, 14, yPos);
        yPos += 6;
      });

      yPos += 4;
      const deptData = (perf || []).map((d) => [
        d.dept,
        String(d.total_complaints),
        String(d.resolved),
        `${Math.round(d.score || 0)}%`,
        String(d.breach_count),
      ]);

      if (deptData.length) {
        autoTable(doc, {
          startY: yPos,
          head: [['Department', 'Total', 'Resolved', 'Score', 'SLA Breaches']],
          body: deptData,
          theme: 'grid',
          headStyles: { fillColor: [13, 22, 40], textColor: [0, 212, 255] },
          styles: { fontSize: 9 },
          margin: { left: 14, right: 14 },
        });
        yPos = doc.lastAutoTable.finalY + 10;
      }

      const complaintRows = (complaints || []).slice(0, 40).map((c) => [
        c.id.slice(0, 8),
        c.dept,
        c.wards?.name || `W${c.ward_id}`,
        c.status,
        String(c.severity),
        format(new Date(c.created_at), 'd MMM'),
      ]);

      if (complaintRows.length) {
        doc.setFontSize(11);
        doc.text('Recent Complaints (top 40)', 14, yPos);
        autoTable(doc, {
          startY: yPos + 4,
          head: [['ID', 'Dept', 'Ward', 'Status', 'Sev', 'Filed']],
          body: complaintRows,
          theme: 'striped',
          headStyles: { fillColor: [13, 22, 40], textColor: [0, 212, 255] },
          styles: { fontSize: 8 },
          margin: { left: 14, right: 14 },
        });
      }

      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        'Confidential — Greater Hyderabad Municipal Corporation',
        14,
        doc.internal.pageSize.height - 10
      );

      doc.save(`NagarRakshak_Report_${format(start, 'yyyy-MM')}.pdf`);
      onClose?.();
    } catch (err) {
      setError(err.message || 'PDF generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') };
  });

  return (
    <GlassModal open={open} onClose={onClose} title="Export Monthly Report" size="md">
      <div className="px-5 py-4">
        <p className="mb-4 text-sm text-text-secondary">
          Generate a PDF summary of civic complaints, department performance, and ward health for
          GHMC leadership review.
        </p>

        <label className="mb-2 block text-sm font-medium text-text-primary">Report month</label>
        <select
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            setPreview(null);
          }}
          className="input-field mb-4"
        >
          {monthOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <button type="button" onClick={loadPreview} className="btn-secondary mb-4 w-full">
          Preview summary
        </button>

        {error && (
          <p className="mb-4 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-text-primary">
            {error}
          </p>
        )}

        {preview && (
          <div className="glass-inset mb-4 p-4">
            <PreviewSummary preview={preview} />
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="button"
            onClick={generatePdf}
            disabled={generating}
            className="btn-primary inline-flex flex-1 items-center justify-center gap-2 disabled:opacity-50"
          >
            {generating ? <LoadingSpinner size="sm" /> : <Download size={16} />}
            Download PDF
          </button>
        </div>
      </div>
    </GlassModal>
  );
}

function PreviewSummary({ preview }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3 text-center">
        <PreviewStat value={preview.total} label="Total" color="text-accent-cyan" />
        <PreviewStat value={preview.resolved} label="Resolved" color="text-accent-emerald" />
        <PreviewStat
          value={`${preview.resolutionRate}%`}
          label="Rate"
          color="text-accent-amber"
        />
      </div>
      {preview.deptRows.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-text-secondary">
          {preview.deptRows.slice(0, 5).map((d) => (
            <li key={d.dept} className="flex justify-between">
              <span>{d.dept}</span>
              <span>{d.total_complaints} complaints</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PreviewStat({ value, label, color }) {
  return (
    <div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-text-secondary">{label}</p>
    </div>
  );
}
