-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migración 011 - Declaración obligatoria en actas de trabajadores
-- ============================================================

BEGIN;

SET search_path TO itam, public;

UPDATE actas_entrega
SET declaracion = $declaracion$El trabajador declara saber que:

- El equipo que aquí se entrega es y será de la empresa en todo momento
  En caso de renuncia del trabajador o desvinculación del trabajador por alguna de las causales legales que den termino al
  contrato de trabajo, según código del trabajo, el trabajador individualizado debe hacer entrega del equipo asignado en este acto
  y su accesorio al término de la relación laboral.
- Debe prestar un buen uso y cuidado a las herramientas de trabajo entregadas por la empresa
- En caso de perdida, robo, hurto, se debe realizar la denuncia ante las autoridades competente (Carabineros o PDI), para
  acreditar que la perdida, no recae en la voluntad del trabajador.
- En caso de perdida, robo, hurto, mal uso o descuido de la herramienta entregada en este acto, el funcionario responsable
  deberá dar aviso al departamento de RRHH para que realicen el bloqueo respectivo del equipo.
  Se establece que la herramienta de trabajo entregada en este acto, son de uso exclusivo del trabajador individualizado, para
  efectuar las funciones de acuerdo con su cargo según contrato de trabajo.
- Tomo conocimiento que las aplicaciones autorizadas por la Empresa son: CAPSI (capturador de Aguas San Isidro), OPSI
  (operación San Isidro), enviar mensaje de texto de la empresa y telemetría, llamadas ilimitadas a la familia móvil, usar
  Whatsapp.
  El trabajador que use el servicios de datos o llamadas telefónicas mediante el aparato celular entregado por la empresa, que
  excedan el plan contratado por la empleadora, utilizado el aparato celular para asuntos personales y en nada vinculado a las
  funciones convenida en el contrato de trabajo, será contabilizado mensualmente y será informado para las respectivas
  sanciones y descuentos que deberá ser asumido por el trabajador y le será descontado de su remuneración, a efectos de lo
  dispuesto en dicho procedimiento, pudiendo el trabajador solicitar el pago en cuotas.$declaracion$
WHERE colaborador_id IS NOT NULL
  AND (declaracion IS NULL OR BTRIM(declaracion) = '');

INSERT INTO schema_migrations(version, nombre)
VALUES ('011', 'backfill_worker_delivery_declaration');

COMMIT;
