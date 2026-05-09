export type Role = "admin" | "crew";

export type UserSummary = {
  id: number;
  email: string;
  username: string;
  role: Role;
  ship_id: number | null;
};

export type LoginResponse = {
  message: string;
  user: UserSummary;
};

export type DashboardMetrics = {
  ships: number;
  maintenance_total: number;
  maintenance_completed: number;
  maintenance_overdue: number;
  drills_total: number;
  drills_completed: number;
  drills_missed: number;
  maintenance_compliance_percent: number;
  drill_compliance_percent: number;
  drill_participation_percent: number;
};

export type ComplianceItems = {
  pending_maintenance: MaintenanceTask[];
  overdue_maintenance: MaintenanceTask[];
  missed_drills: SafetyDrill[];
};

export type Ship = {
  id: number;
  name: string;
  imo_number: string | null;
  current_port: string | null;
  status: string;
};

export type MaintenanceTask = {
  id: number;
  title: string;
  description: string | null;
  ship_id: number;
  assigned_to_id: number | null;
  status: "pending" | "in_progress" | "completed";
  due_date: string;
  created_at: string;
  updated_at: string;
};

export type TaskComment = {
  id: number;
  task_id: number;
  user_id: number;
  comment: string;
  created_at: string;
  user: { id: number; email: string; username: string };
};

export type SafetyDrill = {
  id: number;
  drill_type: string;
  ship_id: number;
  scheduled_date: string;
  status: "scheduled" | "completed" | "missed";
  created_at: string;
};

export type DrillAttendanceEntry = {
  id: number;
  drill_id: number;
  user_id: number;
  attendance: boolean;
  completion_status: string;
  user: { id: number; email: string; username: string };
};
