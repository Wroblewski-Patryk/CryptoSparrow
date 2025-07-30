import * as userService from './basic.service';

export const getProfile = async (req: any, res: any) => {
  const user = await userService.getUser(req.user.id);
  res.json(user);
};

export const updateProfile = async (req: any, res: any) => {
  const updated = await userService.updateUser(req.user.id, req.body);
  res.json(updated);
};
export const deleteUser = async (req: any, res: any) => {
  await userService.deleteUser(req.user.id);
  res.status(204).send();
};