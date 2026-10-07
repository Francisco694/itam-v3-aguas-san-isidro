import { ConflictError } from "../../shared/errors";

export const assertDispositivoSinSimParaBaja = (
  dispositivo: { sim_id: string | null }
): void => {
  if (dispositivo.sim_id) {
    throw new ConflictError(
      "El dispositivo tiene una SIM asociada. Desasocie la SIM antes de darlo de baja."
    );
  }
};
