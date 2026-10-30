import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getCleanTeamName } from '@/lib/utils';
import ExcelJS from 'exceljs';

export async function POST(request: NextRequest) {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json();
  const { group_ids, include_pending = true, include_unassigned = true } = body;

  const supabase = await createAdminClient();

  // Fetch groups
  let groupsQuery = supabase.from('academic_groups').select('id, name').eq('is_active', true).order('name');
  if (group_ids?.length) groupsQuery = groupsQuery.in('id', group_ids);
  const { data: groups } = await groupsQuery;

  if (!groups?.length) {
    return NextResponse.json({ error: 'no_groups_found' }, { status: 404 });
  }

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'مختبر علم الأدوية العملي';
  workbook.created = new Date();

  // Common black border style
  const blackBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  // Row 1: Title Style (#0F172A - Slate 900 Dark Navy)
  const titleStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Calibri', bold: true, size: 16, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' },
    border: blackBorder,
  };

  // Row 3: Team Header Style (#374151 - Gray 700 Dark Slate)
  const teamHeaderStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Calibri', bold: true, size: 13, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' },
    border: blackBorder,
  };

  // Row 4: Table Header Style (#1E40AF - Blue 800 Royal Blue)
  const tableHeaderStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Calibri', bold: true, size: 13, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' },
    border: blackBorder,
  };

  // Team Leader Cell Style (#DBEAFE Ice Blue bg, #1E40AF bold blue text)
  const leaderCellStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Calibri', bold: true, size: 12, color: { argb: 'FF1E40AF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' },
    border: blackBorder,
  };

  // Regular Member Cell Style (White bg, #000000 text)
  const memberCellStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Calibri', size: 12, color: { argb: 'FF000000' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' },
    border: blackBorder,
  };

  // Pending Member Cell Style (#FEF3C7 Amber bg, #92400E text)
  const pendingCellStyle: Partial<ExcelJS.Style> = {
    font: { name: 'Calibri', size: 12, color: { argb: 'FF92400E' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' },
    border: blackBorder,
  };

  for (const group of groups) {
    const sheet = workbook.addWorksheet(group.name, {
      views: [{ rightToLeft: true }],
    });

    // Set exact column widths matching reference table layout
    sheet.getColumn(1).width = 8;   // Col A: 'ت'
    sheet.getColumn(2).width = 42;  // Col B: 'اسم الطالب'
    sheet.getColumn(3).width = 24;  // Col C: 'الدور / الحالة'
    sheet.getColumn(4).width = 16;  // Col D: 'الحضور'

    // Fetch teams for this group
    const { data: teams } = await supabase
      .from('teams')
      .select(`
        id, name, max_capacity,
        team_leader:team_leaders(
          student:students(full_name)
        ),
        memberships:team_memberships(
          id, status, is_leader,
          student:students(id, full_name)
        )
      `)
      .eq('academic_group_id', group.id)
      .eq('is_active', true)
      .order('name');

    // Fetch unassigned students
    const { data: allStudents } = await supabase
      .from('students')
      .select('id, full_name')
      .eq('academic_group_id', group.id)
      .eq('is_active', true);

    const assignedIds = new Set(
      (teams || []).flatMap((t: any) =>
        ((t.memberships as any[]) || [])
          .filter((m: any) => ['confirmed', 'invitation_pending'].includes(m.status))
          .map((m: any) => {
            const studentObj = Array.isArray(m.student) ? m.student[0] : m.student;
            return studentObj?.id;
          })
      ).filter(Boolean)
    );

    const unassignedStudents = (allStudents || []).filter(s => !assignedIds.has(s.id));

    // Row 1: Main Title Row
    sheet.mergeCells('A1:D1');
    const titleRow = sheet.getRow(1);
    titleRow.getCell(1).value = `مختبر علم الأدوية العملي تجربة الارنب — المجموعة الدراسية: ${group.name}`;
    for (let c = 1; c <= 4; c++) {
      titleRow.getCell(c).style = titleStyle;
    }
    titleRow.height = 50;

    // Row 2: Blank Separator Row
    const blankRow = sheet.getRow(2);
    blankRow.height = 20;

    let currentRow = 3;
    let teamCount = 0;

    for (const team of (teams || []) as any[]) {
      teamCount++;
      const memberships = (team.memberships as any[]) || [];
      const confirmedMembers = memberships.filter((m: any) => m.status === 'confirmed');
      const pendingMembers = memberships.filter((m: any) => m.status === 'invitation_pending');
      const cleanTeamName = getCleanTeamName(team.name, group.name);

      // If not the first team, add separator row and page break before next team
      if (teamCount > 1) {
        sheet.getRow(currentRow - 1).addPageBreak();
        const sepRow = sheet.getRow(currentRow);
        sepRow.height = 20;
        currentRow++;
      }

      // Team Header Row (Row 3 for Team 1)
      sheet.mergeCells(`A${currentRow}:D${currentRow}`);
      const teamHeaderRow = sheet.getRow(currentRow);
      teamHeaderRow.getCell(1).value = `المجموعة ${group.name} — ${cleanTeamName} | السعة: ${confirmedMembers.length}/${team.max_capacity}`;
      for (let c = 1; c <= 4; c++) {
        teamHeaderRow.getCell(c).style = teamHeaderStyle;
      }
      teamHeaderRow.height = 38;
      currentRow++;

      // Table Header Row (Row 4 for Team 1)
      const colRow = sheet.getRow(currentRow);
      colRow.getCell(1).value = 'ت';
      colRow.getCell(2).value = 'اسم الطالب';
      colRow.getCell(3).value = 'الدور / الحالة';
      colRow.getCell(4).value = 'الحضور';
      for (let c = 1; c <= 4; c++) {
        colRow.getCell(c).style = tableHeaderStyle;
      }
      colRow.height = 32;
      currentRow++;

      let studentSeq = 1;

      // Confirmed members (preserves exact original order)
      for (const member of confirmedMembers) {
        const student = Array.isArray(member.student) ? member.student[0] : member.student;
        const memberRow = sheet.getRow(currentRow);
        memberRow.getCell(1).value = studentSeq++;
        memberRow.getCell(2).value = student?.full_name || '';
        memberRow.getCell(3).value = member.is_leader ? 'قائد الفريق' : 'عضو';
        memberRow.getCell(4).value = '';

        const style = member.is_leader ? leaderCellStyle : memberCellStyle;
        for (let c = 1; c <= 4; c++) {
          memberRow.getCell(c).style = style;
        }
        memberRow.height = 30;
        currentRow++;
      }

      // Pending members if included
      if (include_pending) {
        for (const member of pendingMembers) {
          const student = Array.isArray(member.student) ? member.student[0] : member.student;
          const memberRow = sheet.getRow(currentRow);
          memberRow.getCell(1).value = studentSeq++;
          memberRow.getCell(2).value = student?.full_name || '';
          memberRow.getCell(3).value = 'في انتظار التأكيد';
          memberRow.getCell(4).value = '';

          for (let c = 1; c <= 4; c++) {
            memberRow.getCell(c).style = pendingCellStyle;
          }
          memberRow.height = 30;
          currentRow++;
        }
      }
    }

    // Unassigned students section
    if (include_unassigned && unassignedStudents.length > 0) {
      sheet.getRow(currentRow - 1).addPageBreak();
      const sepRow = sheet.getRow(currentRow);
      sepRow.height = 20;
      currentRow++;

      sheet.mergeCells(`A${currentRow}:D${currentRow}`);
      const unassignedHeader = sheet.getRow(currentRow);
      unassignedHeader.getCell(1).value = `الطلاب غير الموزعين (${unassignedStudents.length} طالب)`;
      for (let c = 1; c <= 4; c++) {
        unassignedHeader.getCell(c).style = {
          font: { name: 'Calibri', bold: true, size: 13, color: { argb: 'FFFFFFFF' } },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } },
          alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' },
          border: blackBorder,
        };
      }
      unassignedHeader.height = 36;
      currentRow++;

      const colRow = sheet.getRow(currentRow);
      colRow.getCell(1).value = 'ت';
      colRow.getCell(2).value = 'اسم الطالب';
      colRow.getCell(3).value = 'الحالة';
      colRow.getCell(4).value = 'ملاحظات';
      for (let c = 1; c <= 4; c++) {
        colRow.getCell(c).style = tableHeaderStyle;
      }
      colRow.height = 32;
      currentRow++;

      let uSeq = 1;
      for (const student of unassignedStudents) {
        const row = sheet.getRow(currentRow);
        row.getCell(1).value = uSeq++;
        row.getCell(2).value = student.full_name;
        row.getCell(3).value = 'غير موزع';
        row.getCell(4).value = '';
        for (let c = 1; c <= 4; c++) {
          row.getCell(c).style = {
            font: { name: 'Calibri', size: 12, color: { argb: 'FF4B5563' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
            alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' },
            border: blackBorder,
          };
        }
        row.height = 30;
        currentRow++;
      }
    }

    const lastRowIndex = currentRow - 1;
    const totalPages = Math.max(1, (teams?.length || 1) + (include_unassigned && unassignedStudents.length > 0 ? 1 : 0));

    // Page Setup Configuration according to exact requirements:
    // - Right-to-Left direction
    // - Paper Size: A4 (paperSize: 9)
    // - Orientation: Landscape (Horizontal)
    // - Margins: Center on page Horizontally & Vertically
    // - Print Area: Entire exported table (A1:D...)
    // - Scaling: Fit to one A4 page width & height (scale: 110%)
    sheet.pageSetup = {
      paperSize: 9, // A4
      orientation: 'landscape', // Landscape (Horizontal)
      horizontalCentered: true, // Center on page: Horizontally
      verticalCentered: true, // Center on page: Vertically
      fitToPage: true, // Scale to fit page
      fitToWidth: 1, // Fit to 1 page wide
      fitToHeight: totalPages <= 1 ? 1 : totalPages, // Fit to 1 page height whenever single team/table
      scale: 110, // 110% scaling from reference image
      printArea: `A1:D${lastRowIndex}`, // Print area includes the entire table
      printTitlesRow: '1:1', // Repeat title row at top of printed pages
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.5,
        bottom: 0.5,
        header: 0.3,
        footer: 0.3,
      },
    };
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  const filename = `teams-export-${new Date().toISOString().split('T')[0]}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
