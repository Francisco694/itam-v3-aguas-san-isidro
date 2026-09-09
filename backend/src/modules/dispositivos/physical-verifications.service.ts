import { ConflictError, NotFoundError } from "../../shared/errors";
import { toIsoDateTime } from "../../shared/dates";
import {
  insertarVerificacionFisica,
  listarVerificacionesFisicas,
  obtenerDispositivoParaVerificacion,
  obtenerUltimaVerificacionFisica
} from "./physical-verifications.repository";
import type {
  DispositivoVerificacionRow,
  RegistrarVerificacionFisicaInput,
  ResultadoVerificacionFisica,
  VerificacionFisica,
  VerificacionFisicaRow
} from "./physical-verifications.types";

export const clasificarVerificacionFisica = (
  dispositivo: DispositivoVerificacionRow,
  encontrado: boolean,
  identificadorComprobado: string | null
): { resultado: ResultadoVerificacionFisica; identificadorEsperado: string | null } => {
  const esSmartphone = dispositivo.tipo_nombre.trim().toUpperCase() === "SMARTPHONE";
  const identificadorEsperado = esSmartphone ? dispositivo.imei : dispositivo.numero_serie;
  if (!encontrado) return { resultado: "REVISAR", identificadorEsperado };
  if (
    identificadorComprobado !== null &&
    identificadorEsperado !== null &&
    identificadorComprobado === identificadorEsperado
  ) {
    if (
      dispositivo.estado_codigo === "EXTRAVIADO" ||
      dispositivo.estado_codigo === "DADO_BAJA" ||
      (dispositivo.estado_codigo === "ASIGNADO" &&
        !dispositivo.colaborador_id &&
        !dispositivo.departamento_id)
    ) {
      return { resultado: "REVISAR", identificadorEsperado };
    }
    return { resultado: "VERIFICADO", identificadorEsperado };
  }
  return { resultado: "REVISAR", identificadorEsperado };
};

const toVerification = (row: VerificacionFisicaRow): VerificacionFisica => ({
  id: String(row.id),
  dispositivoId: String(row.dispositivo_id),
  encontrado: row.encontrado,
  identificadorComprobado: row.identificador_comprobado,
  identificadorEsperado: row.identificador_esperado,
  resultado: row.resultado,
  observacion: row.observacion,
  usuario: row.usuario_id
    ? { id: String(row.usuario_id), nombre: row.usuario_nombre, email: row.usuario_email }
    : null,
  fechaVerificacion: toIsoDateTime(row.fecha_verificacion)
});

export const registrarVerificacionFisica = async (
  codigo: number,
  input: RegistrarVerificacionFisicaInput
): Promise<VerificacionFisica> => {
  const dispositivo = await obtenerDispositivoParaVerificacion(codigo);
  if (!dispositivo) throw new NotFoundError("Dispositivo no encontrado.");
  const ultima = await obtenerUltimaVerificacionFisica(dispositivo.id);
  if (ultima && ultima !== "PENDIENTE") {
    throw new ConflictError("El equipo ya cuenta con evidencia de verificación.");
  }

  const comprobado = input.identificadorComprobado?.trim() || null;
  const { resultado, identificadorEsperado } = clasificarVerificacionFisica(
    dispositivo,
    input.encontrado,
    comprobado
  );

  return toVerification(
    await insertarVerificacionFisica(
      dispositivo,
      {
        encontrado: input.encontrado,
        identificadorComprobado: comprobado,
        identificadorEsperado,
        resultado,
        observacion: input.observacion ?? null,
        responsable: input.responsable,
        motivo: "revisión manual"
      }
    )
  );
};

export const registrarVerificacionAutomaticaPorOperacion = async (
  codigo: number,
  motivo: string,
  responsable: string,
  client: import("pg").PoolClient
): Promise<void> => {
  const dispositivo = await obtenerDispositivoParaVerificacion(codigo, client);
  if (!dispositivo) throw new NotFoundError("Dispositivo no encontrado.");
  const ultima = await obtenerUltimaVerificacionFisica(dispositivo.id, client);
  if (ultima && ultima !== "PENDIENTE") return;

  const identificadorEsperado =
    dispositivo.tipo_nombre.trim().toUpperCase() === "SMARTPHONE"
      ? dispositivo.imei
      : dispositivo.numero_serie;
  await insertarVerificacionFisica(
    dispositivo,
    {
      encontrado: true,
      identificadorComprobado: identificadorEsperado,
      identificadorEsperado,
      resultado: "VERIFICADO",
      observacion: `Equipo verificado mediante operación física: ${motivo}.`,
      responsable,
      motivo
    },
    client
  );
};

export const obtenerVerificacionesFisicas = async (
  codigo: number
): Promise<VerificacionFisica[]> => {
  if (!(await obtenerDispositivoParaVerificacion(codigo))) {
    throw new NotFoundError("Dispositivo no encontrado.");
  }
  return (await listarVerificacionesFisicas(codigo)).map(toVerification);
};
