export const canAccess = (user, roles = []) => {
  if (!user) return false;
  return roles.includes(user.role);
};

export const isAdmin = (user) =>
  ['SHOP_ADMIN', 'SUPER_ADMIN'].includes(user?.role);

export const isSuperAdmin = (user) =>
  user?.role === 'SUPER_ADMIN';