import type { updateUserRole } from "@/app/admin/user-actions";
import type { AdminUser } from "@/lib/users";

type UserRoleFormProps = {
  action: typeof updateUserRole;
  user: AdminUser;
  disabled: boolean;
};

export default function UserRoleForm({ action, user, disabled }: UserRoleFormProps) {
  return (
    <form action={action} className="admin-user-role-form">
      <input type="hidden" name="user_id" value={user.id} />
      <label>
        Role
        <select name="role" defaultValue={user.role} disabled={disabled}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <button className="button button-ghost" type="submit" disabled={disabled}>
        Update role
      </button>
    </form>
  );
}
