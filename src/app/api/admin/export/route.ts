import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
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

  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } },
    alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' },
    border: {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    },
  };

  const teamHeaderStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } },
    alignment: { horizontal: 'right', vertical: 'middle', readingOrder: 'rtl' },
  };

  const leaderRowStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: 'FF1E40AF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } },
    alignment: { horizontal: 'right', vertical: 'middle', readingOrder: 'rtl' },
  };

  const memberRowStyle: Partial<ExcelJS.Style> = {
    font: { size: 10 },
    alignment: { horizontal: 'right', vertical: 'middle', readingOrder: 'rtl' },
  };

  const pendingRowStyle: Partial<ExcelJS.Style> = {
    font: { size: 10, color: { argb: 'FF92400E' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } },
    alignment: { horizontal: 'right', vertical: 'middle', readingOrder: 'rtl' },
  };

  for (const group of groups) {
    const sheet = workbook.addWorksheet(group.name, {
      views: [{ rightToLeft: true }],
    });

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

    // Title row
    sheet.mergeCells('A1:B1');
    const titleRow = sheet.getRow(1);
    titleRow.getCell(1).value = `مختبر علم الأدوية العملي — المجموعة الدراسية: ${group.name}`;
    titleRow.getCell(1).style = {
      font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } },
      alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' },
    };
    titleRow.height = 35;
    sheet.addRow([]);

    // Column widths
    sheet.getColumn(1).width = 40;
    sheet.getColumn(2).width = 25;

    let currentRow = 3;

    for (const team of (teams || []) as any[]) {
      const leaderObj = Array.isArray(team.team_leader) ? team.team_leader[0] : team.team_leader;
      const leader = Array.isArray(leaderObj?.student) ? leaderObj?.student[0] : leaderObj?.student;
      const memberships = (team.memberships as any[]) || [];
      const confirmedMembers = memberships.filter((m: any) => m.status === 'confirmed');
      const pendingMembers = memberships.filter((m: any) => m.status === 'invitation_pending');

      // Team header
      sheet.mergeCells(`A${currentRow}:B${currentRow}`);
      const teamHeaderRow = sheet.getRow(currentRow);
      teamHeaderRow.getCell(1).value = `${team.name} | القائد: ${leader?.full_name || 'غير محدد'} | السعة: ${confirmedMembers.length}/${team.max_capacity}`;
      teamHeaderRow.getCell(1).style = teamHeaderStyle;
      teamHeaderRow.height = 25;
      currentRow++;

      // Column headers
      const colRow = sheet.getRow(currentRow);
      colRow.getCell(1).value = 'اسم الطالب';
      colRow.getCell(2).value = 'الدور / الحالة';
      colRow.getCell(1).style = headerStyle;
      colRow.getCell(2).style = headerStyle;
      colRow.height = 22;
      currentRow++;

      // Confirmed members
      for (const member of confirmedMembers) {
        const student = Array.isArray(member.student) ? member.student[0] : member.student;
        const memberRow = sheet.getRow(currentRow);
        memberRow.getCell(1).value = student?.full_name || '';
        memberRow.getCell(2).value = member.is_leader ? 'قائد الفريق' : 'عضو';
        const style = member.is_leader ? leaderRowStyle : memberRowStyle;
        memberRow.getCell(1).style = style;
        memberRow.getCell(2).style = style;
        memberRow.height = 20;
        currentRow++;
      }

      // Pending members
      if (include_pending) {
        for (const member of pendingMembers) {
          const student = Array.isArray(member.student) ? member.student[0] : member.student;
          const memberRow = sheet.getRow(currentRow);
          memberRow.getCell(1).value = student?.full_name || '';
          memberRow.getCell(2).value = 'في انتظار التأكيد';
          memberRow.getCell(1).style = pendingRowStyle;
          memberRow.getCell(2).style = pendingRowStyle;
          memberRow.height = 20;
          currentRow++;
        }
      }

      // Empty rows between teams
      sheet.addRow([]);
      sheet.addRow([]);
      currentRow += 2;
    }

    // Unassigned students sheet section
    if (include_unassigned && unassignedStudents.length > 0) {
      sheet.addRow([]);
      sheet.mergeCells(`A${currentRow}:B${currentRow}`);
      const unassignedHeader = sheet.getRow(currentRow);
      unassignedHeader.getCell(1).value = `الطلاب غير الموزعين (${unassignedStudents.length} طالب)`;
      unassignedHeader.getCell(1).style = {
        font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } },
        alignment: { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' },
      };
      unassignedHeader.height = 25;
      currentRow++;

      const colRow = sheet.getRow(currentRow);
      colRow.getCell(1).value = 'اسم الطالب';
      colRow.getCell(2).value = 'الحالة';
      colRow.getCell(1).style = headerStyle;
      colRow.getCell(2).style = headerStyle;
      currentRow++;

      for (const student of unassignedStudents) {
        const row = sheet.getRow(currentRow);
        row.getCell(1).value = student.full_name;
        row.getCell(2).value = 'غير موزع';
        const unStyle: Partial<ExcelJS.Style> = {
          font: { size: 10, color: { argb: 'FF6B7280' } },
          alignment: { horizontal: 'right', readingOrder: 'rtl' },
        };
        row.getCell(1).style = unStyle;
        row.getCell(2).style = unStyle;
        row.height = 20;
        currentRow++;
      }
    }
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
