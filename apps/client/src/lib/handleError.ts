export const handleError = (err: any) => {
  return err?.response?.data?.error || 'Wystąpił błąd';
};