import { jsPDF } from 'jspdf';
import { formatDisplayDate } from '../constants';
import { AnalyticsSummary, DateFormatPref, PerspectiveMode } from '../types';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return [37, 99, 235];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function formatStatusLabel(status: string): string {
  if (status === 'at_risk') return 'At Risk';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function downloadAnalyticsPdf(
  analytics: AnalyticsSummary,
  options: {
    dateFormat: DateFormatPref;
    perspective: PerspectiveMode;
    generatedByName?: string;
  }
): { filename: string } {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const footerReserve = 16;

  let y = 0;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - footerReserve) {
      doc.addPage();
      y = margin;
    }
  };

  const drawSectionHeading = (title: string, subtitle?: string) => {
    ensureSpace(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin, y);
    y += 4.5;
    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(subtitle, margin, y);
      y += 4.5;
    }
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;
  };

  // Header Banner
  doc.setFillColor(11, 19, 43);
  doc.rect(0, 0, pageWidth, 34, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('Cadence Analytics & Progress Report', margin, 14);

  const generatedDate = formatDisplayDate(new Date().toISOString(), options.dateFormat);
  const scopeLabel =
    options.perspective === 'employee' ? 'Personal Workload Scope' : 'Workspace-Wide Scope';
  const metaParts = [
    scopeLabel,
    `Generated ${generatedDate}`,
    options.generatedByName ? `Prepared for ${options.generatedByName}` : '',
  ].filter(Boolean);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(metaParts.join('  |  '), margin, 22.5);

  y = 43;

  // 1. KPI Summary Grid (4 cards)
  drawSectionHeading(
    'Executive Summary',
    'Core delivery velocity, active backlog, and completion performance'
  );

  const kpis: Array<{ label: string; value: string; sub: string; color: [number, number, number] }> =
    [
      {
        label: 'COMPLETION RATE',
        value: `${analytics.completionRate}%`,
        sub: `${analytics.completedTasks} of ${analytics.totalTasks} tasks`,
        color: [22, 163, 74],
      },
      {
        label: 'AVG COMPLETION TIME',
        value: `${analytics.avgCompletionHours}h`,
        sub: 'Across completed tasks',
        color: [15, 23, 42],
      },
      {
        label: 'IN PROGRESS',
        value: String(analytics.inProgressTasks),
        sub: `${analytics.todoTasks} to do · ${analytics.onHoldTasks} on hold`,
        color: [37, 99, 235],
      },
      {
        label: 'OVERDUE ALERTS',
        value: String(analytics.overdueTasks),
        sub: analytics.overdueTasks > 0 ? 'Requires attention' : 'On schedule',
        color: analytics.overdueTasks > 0 ? [220, 38, 38] : [22, 163, 74],
      },
    ];

  const cardGap = 4;
  const cardWidth = (contentWidth - cardGap * 3) / 4;
  const cardHeight = 23;

  kpis.forEach((kpi, idx) => {
    const cx = margin + idx * (cardWidth + cardGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cx, y, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, cx + 3.5, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, cx + 3.5, y + 14.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105);
    doc.text(kpi.sub, cx + 3.5, y + 19.8, { maxWidth: cardWidth - 7 });
  });

  y += cardHeight + 9;

  // 2. Project Progress Metrics
  drawSectionHeading(
    'Project Progress Metrics',
    'Task completion ratio and status across active workspace projects'
  );

  if (analytics.projectProgress.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('No projects found in workspace.', margin, y);
    y += 8;
  } else {
    // Table header
    ensureSpace(10);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('PROJECT', margin + 3, y + 5);
    doc.text('STATUS', margin + 78, y + 5);
    doc.text('TASKS', margin + 108, y + 5);
    doc.text('PROGRESS', margin + 132, y + 5);
    y += 7.5;

    analytics.projectProgress.forEach((proj, idx) => {
      ensureSpace(9);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 8.5, 'F');
      }
      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + 8.5, margin + contentWidth, y + 8.5);

      const [r, g, b] = hexToRgb(proj.color);
      doc.setFillColor(r, g, b);
      doc.circle(margin + 4.5, y + 4.3, 1.3, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      const projName = proj.name.length > 34 ? `${proj.name.slice(0, 32)}...` : proj.name;
      doc.text(projName, margin + 8, y + 5.3);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(formatStatusLabel(proj.status), margin + 78, y + 5.3);

      doc.text(`${proj.completed}/${proj.total}`, margin + 108, y + 5.3);

      // Mini progress bar
      const barX = margin + 132;
      const barW = 30;
      const pct = Math.max(0, Math.min(100, proj.progress));
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(barX, y + 3, barW, 2.5, 1, 1, 'F');
      if (pct > 0) {
        doc.setFillColor(r, g, b);
        doc.roundedRect(barX, y + 3, Math.max(1.5, (barW * pct) / 100), 2.5, 1, 1, 'F');
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`${pct}%`, margin + contentWidth - 3, y + 5.3, { align: 'right' });

      y += 8.5;
    });
    y += 7;
  }

  // 3. Task Breakdown & 7-Day Throughput (Side by Side)
  ensureSpace(48);
  const halfWidth = (contentWidth - 6) / 2;
  const startBlockY = y;

  // Left: Status & Priority Breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Task Progress Breakdown', margin, y);
  doc.text('7-Day Creation vs Completion', margin + halfWidth + 6, y);
  y += 4;

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, margin + halfWidth, y);
  doc.line(margin + halfWidth + 6, y, margin + contentWidth, y);
  y += 5;

  let leftY = y;
  analytics.statusBreakdown.forEach((st) => {
    const share =
      analytics.totalTasks > 0 ? Math.round((st.value / analytics.totalTasks) * 100) : 0;
    const [r, g, b] = hexToRgb(st.color);
    doc.setFillColor(r, g, b);
    doc.circle(margin + 2.5, leftY - 1, 1.2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(st.name, margin + 6, leftY);
    doc.setFont('helvetica', 'bold');
    doc.text(`${st.value} (${share}%)`, margin + halfWidth - 2, leftY, { align: 'right' });
    leftY += 5.5;
  });

  leftY += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Open Backlog by Priority:', margin, leftY);
  leftY += 5;
  analytics.priorityBreakdown.forEach((pr) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`${pr.name} Priority`, margin + 3, leftY);
    doc.setFont('helvetica', 'bold');
    doc.text(`${pr.count} open`, margin + halfWidth - 2, leftY, { align: 'right' });
    leftY += 5;
  });

  // Right: 7-Day Throughput table
  let rightY = startBlockY + 9;
  const rx = margin + halfWidth + 6;
  doc.setFillColor(241, 245, 249);
  doc.rect(rx, rightY - 4, halfWidth, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('DAY', rx + 2.5, rightY + 0.5);
  doc.text('CREATED', rx + 35, rightY + 0.5, { align: 'right' });
  doc.text('COMPLETED', rx + 62, rightY + 0.5, { align: 'right' });
  doc.text('NET', rx + halfWidth - 2.5, rightY + 0.5, { align: 'right' });
  rightY += 6.5;

  analytics.weeklyThroughput.forEach((dayRow) => {
    const net = dayRow.completed - dayRow.created;
    const netStr = net > 0 ? `+${net}` : String(net);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(30, 41, 59);
    doc.text(dayRow.day, rx + 2.5, rightY);
    doc.text(String(dayRow.created), rx + 35, rightY, { align: 'right' });
    doc.text(String(dayRow.completed), rx + 62, rightY, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(net >= 0 ? 22 : 217, net >= 0 ? 163 : 119, net >= 0 ? 74 : 6);
    doc.text(netStr, rx + halfWidth - 2.5, rightY, { align: 'right' });
    doc.setDrawColor(241, 245, 249);
    doc.line(rx, rightY + 1.8, rx + halfWidth, rightY + 1.8);
    rightY += 5.4;
  });

  y = Math.max(leftY, rightY) + 7;

  // 4. Employee Workload & Delivery Table
  drawSectionHeading(
    'Employee Workload & Delivery Report',
    'Task allocation, active load, completions, and overdue count by team member'
  );

  const drawWorkloadHeader = () => {
    ensureSpace(10);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('TEAM MEMBER', margin + 3, y + 5);
    doc.text('DEPARTMENT', margin + 62, y + 5);
    doc.text('TOTAL', margin + 114, y + 5, { align: 'right' });
    doc.text('ACTIVE', margin + 134, y + 5, { align: 'right' });
    doc.text('DONE', margin + 156, y + 5, { align: 'right' });
    doc.text('OVERDUE', margin + contentWidth - 3, y + 5, { align: 'right' });
    y += 7.5;
  };

  drawWorkloadHeader();

  analytics.workloadByEmployee.forEach((row, idx) => {
    if (y + 8 > pageHeight - footerReserve) {
      doc.addPage();
      y = margin;
      drawWorkloadHeader();
    }
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, 7.5, 'F');
    }
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y + 7.5, margin + contentWidth, y + 7.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(15, 23, 42);
    const memberName = row.name.length > 28 ? `${row.name.slice(0, 26)}...` : row.name;
    doc.text(memberName, margin + 3, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const dept = row.department.length > 22 ? `${row.department.slice(0, 20)}...` : row.department;
    doc.text(dept, margin + 62, y + 5);

    doc.text(String(row.total), margin + 114, y + 5, { align: 'right' });
    doc.setTextColor(37, 99, 235);
    doc.text(String(row.active), margin + 134, y + 5, { align: 'right' });
    doc.setTextColor(22, 163, 74);
    doc.text(String(row.completed), margin + 156, y + 5, { align: 'right' });
    doc.setTextColor(row.overdue > 0 ? 220 : 100, row.overdue > 0 ? 38 : 116, row.overdue > 0 ? 38 : 139);
    doc.text(String(row.overdue), margin + contentWidth - 3, y + 5, { align: 'right' });

    y += 7.5;
  });

  // Page Footers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Cadence Workspace · Analytics Summary', margin, pageHeight - 7.5);
    doc.text(`Page ${p} of ${totalPages}`, margin + contentWidth, pageHeight - 7.5, {
      align: 'right',
    });
  }

  const datePart = new Date().toISOString().slice(0, 10);
  const filename = `cadence-analytics-report-${datePart}.pdf`;
  doc.save(filename);
  return { filename };
}
