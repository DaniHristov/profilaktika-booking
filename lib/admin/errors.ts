// Bulgarian messages for admin function errors (SQLSTATE codes from the
// migrations). Never includes database details.
const ADMIN_ERROR_MESSAGES: Record<string, string> = {
  PB100: "Нямате права за това действие.",
  PB101: "Часът има записвания (включително отменени) и не може да бъде изтрит. Можете да го блокирате.",
  PB102: "Капацитетът не може да е по-малък от броя на активните записвания за този час.",
  PB103: "Невалидни данни. Моля, проверете полетата.",
  PB104: "Този адрес на линка (slug) вече се използва от друга кампания.",
  PB105: "Записът не е намерен. Възможно е да е изтрит.",
  PB001: "Няма свободно място в избрания час.",
  PB002: "С този имейл вече има активно записване в тази кампания.",
  PB003: "Избраният час не е наличен (минал, блокиран или кампанията е неактивна).",
};

export const ADMIN_GENERIC_ERROR = "Възникна грешка. Моля, опитайте отново.";

export function adminErrorMessage(code: string | undefined): string {
  return (code && ADMIN_ERROR_MESSAGES[code]) || ADMIN_GENERIC_ERROR;
}

export type AdminActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };
