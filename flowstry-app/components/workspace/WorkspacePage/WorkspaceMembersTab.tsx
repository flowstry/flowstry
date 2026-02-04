"use client";

import type { WorkspaceInviteResponse, WorkspaceMemberResponse, WorkspaceRole } from "@/lib/workspace-client";
import { useWorkspaceTheme } from "../useWorkspaceTheme";

interface WorkspaceMembersTabProps {
  membersError: string | null;
  canManageMembers: boolean;
  inviteEmail: string;
  setInviteEmail: (value: string) => void;
  inviteRole: WorkspaceRole;
  setInviteRole: (value: WorkspaceRole) => void;
  inviteSubmitting: boolean;
  handleInviteSubmit: () => void;
  members: WorkspaceMemberResponse[];
  membersLoading: boolean;
  memberActionId: string | null;
  handleMemberRoleChange: (memberId: string, role: WorkspaceRole) => Promise<void>;
  handleRemoveMember: (memberId: string) => Promise<void>;
  workspaceInvites: WorkspaceInviteResponse[];
  inviteActionId: string | null;
  handleRevokeInvite: (inviteId: string) => Promise<void>;
  formatRoleLabel: (role: WorkspaceRole) => string;
  formatDate: (dateString: string) => string;
  getInitials: (name?: string, email?: string) => string;
}

export default function WorkspaceMembersTab({
  membersError,
  canManageMembers,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  inviteSubmitting,
  handleInviteSubmit,
  members,
  membersLoading,
  memberActionId,
  handleMemberRoleChange,
  handleRemoveMember,
  workspaceInvites,
  inviteActionId,
  handleRevokeInvite,
  formatRoleLabel,
  formatDate,
  getInitials,
}: WorkspaceMembersTabProps) {
  const { classes, isDark } = useWorkspaceTheme();
  return (
    <div className="pt-6 space-y-6">
      {membersError && (
        <div className="rounded-lg border border-red-900/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {membersError}
        </div>
      )}

      {canManageMembers && (
        <div className={`rounded-xl border p-4 ${classes.surfaceMuted}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-sm font-semibold ${classes.text}`}>Invite members</h3>
            <span className={`text-xs ${classes.textSubtle}`}>
              {members.length} member{members.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="name@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${classes.input}`}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
              className={`rounded-lg border px-3 py-2 text-sm ${classes.input}`}
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              onClick={handleInviteSubmit}
              disabled={inviteSubmitting || !inviteEmail.trim()}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                inviteSubmitting || !inviteEmail.trim()
                  ? "opacity-60 cursor-not-allowed"
                  : "bg-(--primary) text-zinc-900 hover:brightness-110 btn-glow"
              }`}
            >
              {inviteSubmitting ? "Sending..." : "Send invite"}
            </button>
          </div>
        </div>
      )}

      <div className={`rounded-xl border ${classes.surfaceMuted}`}>
        <div className={`px-5 py-4 border-b ${classes.border}`}>
          <h3 className={`text-sm font-semibold ${classes.text}`}>Members</h3>
        </div>
        {membersLoading ? (
          <div className={`px-5 py-6 text-sm ${classes.textMuted}`}>Loading members...</div>
        ) : members.length === 0 ? (
          <div className={`px-5 py-6 text-sm ${classes.textMuted}`}>No members found yet.</div>
        ) : (
          <div className={`divide-y ${isDark ? "divide-zinc-800/60" : "divide-zinc-200"}`}>
            {members.map((member) => (
              <div key={member.user_id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.name} className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] text-(--primary) flex items-center justify-center text-xs font-semibold">
                      {getInitials(member.name, member.email)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className={`text-sm font-medium truncate ${classes.text}`}>{member.name}</div>
                    <div className={`text-xs truncate ${classes.textMuted}`}>
                      {member.email} • Joined {formatDate(member.joined_at)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {canManageMembers && member.role !== "owner" ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleMemberRoleChange(member.user_id, e.target.value as WorkspaceRole)}
                      disabled={memberActionId === member.user_id}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${classes.input}`}
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      isDark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-200 text-zinc-700"
                    }`}>
                      {formatRoleLabel(member.role)}
                    </span>
                  )}
                  {canManageMembers && member.role !== "owner" && (
                    <button
                      onClick={() => handleRemoveMember(member.user_id)}
                      disabled={memberActionId === member.user_id}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                        isDark ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                      }`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canManageMembers && (
        <div className={`rounded-xl border ${classes.surfaceMuted}`}>
          <div className={`px-5 py-4 border-b ${classes.border}`}>
            <h3 className={`text-sm font-semibold ${classes.text}`}>Pending invites</h3>
          </div>
          {workspaceInvites.length === 0 ? (
            <div className={`px-5 py-6 text-sm ${classes.textMuted}`}>No pending invites.</div>
          ) : (
            <div className={`divide-y ${isDark ? "divide-zinc-800/60" : "divide-zinc-200"}`}>
              {workspaceInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <div className={`text-sm font-medium ${classes.text}`}>{invite.email}</div>
                    <div className={`text-xs ${classes.textMuted}`}>
                      {formatRoleLabel(invite.role)} • Sent {formatDate(invite.created_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeInvite(invite.id)}
                    disabled={inviteActionId === invite.id}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                      isDark ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                    }`}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
