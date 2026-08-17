import assert from "node:assert/strict";
import test, { after } from "node:test";
import { pool } from "../../config/database";
import { ValidationError } from "../../shared/errors";
import { crearDispositivo } from "../dispositivos/dispositivos.repository";
import {
  actualizarTipoDispositivo,
  crearTipoDispositivo,
  obtenerTipoDispositivoPorId
} from "../tipos-dispositivo/tipos-dispositivo.repository";
import {
  resolverTipoActivoParaAlta
} from "../tipos-dispositivo/tipos-dispositivo.service";
import { generateInventoryCodeByFamilyId } from "./inventory-code.service";

after(async () => { await pool.end(); });

test("el catálogo permite crear, consultar, editar y desactivar sin borrar", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const creado = await crearTipoDispositivo({
      nombre: "TEST Tipo Catálogo",
      descripcion: "Fixture transaccional"
    }, client);
    assert.equal(creado.nombre, "TEST Tipo Catálogo");

    const consultado = await obtenerTipoDispositivoPorId(
      Number(creado.id), client
    );
    assert.equal(consultado?.descripcion, "Fixture transaccional");

    const editado = await actualizarTipoDispositivo(Number(creado.id), {
      nombre: "TEST Tipo Actualizado",
      activo: false
    }, client);
    assert.equal(editado?.nombre, "TEST Tipo Actualizado");
    assert.equal(editado?.activo, false);
    assert.equal(await obtenerTipoDispositivoPorId(2_147_483_647, client), null);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("el catálogo rechaza nombres duplicados sin distinguir mayúsculas", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await crearTipoDispositivo({ nombre: "TEST Duplicado" }, client);
    await assert.rejects(
      crearTipoDispositivo({ nombre: " test duplicado " }, client),
      (error: unknown) => (error as { code?: string }).code === "23505"
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("un tipo sin familia entrega un error explícito al preparar el alta", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const notebook = await crearTipoDispositivo({
      nombre: "TEST Sin Familia",
      descripcion: "Fixture transaccional"
    }, client);
    await assert.rejects(
      resolverTipoActivoParaAlta(Number(notebook.id), client),
      (error: unknown) =>
        error instanceof ValidationError &&
        error.message.includes("no tiene una familia de código activa")
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("las familias confirmadas y sus tipos canónicos están configurados", async () => {
  const result = await pool.query<{ tipo: string; prefijo: string }>(`
    SELECT tipo.nombre AS tipo, familia.prefijo
    FROM itam.tipos_dispositivo AS tipo
    JOIN itam.familias_codigo_inventario AS familia
      ON familia.id = tipo.familia_codigo_inventario_id
    WHERE LOWER(tipo.nombre) IN ('smartphone', 'notebook', 'monitor', 'pc')
    ORDER BY familia.prefijo
  `);
  assert.deepEqual(result.rows, [
    { tipo: "Smartphone", prefijo: "1" },
    { tipo: "Notebook", prefijo: "3" },
    { tipo: "Monitor", prefijo: "4" },
    { tipo: "PC", prefijo: "5" }
  ]);
});

test("no se crea un tipo periférico genérico de forma automática", async () => {
  const result = await pool.query<{ total: string }>(
    "SELECT COUNT(*)::text AS total FROM itam.tipos_dispositivo WHERE LOWER(BTRIM(nombre)) IN ('periférico','periferico','periféricos','perifericos')"
  );
  assert.equal(result.rows[0]!.total, "0");
});

test("PostgreSQL protege la familia de un tipo que ya emitió activos", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const usedType = await client.query<{ id: string; family_id: string | null }>(`
      SELECT tipo.id, tipo.familia_codigo_inventario_id AS family_id
      FROM itam.tipos_dispositivo AS tipo
      JOIN itam.dispositivos AS dispositivo ON dispositivo.tipo_dispositivo_id = tipo.id
      LIMIT 1
    `);
    const otherFamily = await client.query<{ id: string }>(
      "SELECT id FROM itam.familias_codigo_inventario WHERE tipo_entidad='DISPOSITIVO' AND id IS DISTINCT FROM $1 ORDER BY id DESC LIMIT 1",
      [usedType.rows[0]?.family_id ?? null]
    );
    if (!usedType.rows[0] || !otherFamily.rows[0]) return;
    await assert.rejects(
      client.query("UPDATE itam.tipos_dispositivo SET familia_codigo_inventario_id=$2 WHERE id=$1", [usedType.rows[0].id, otherFamily.rows[0].id]),
      (error: unknown) => (error as { code?: string }).code === "P0001"
    );
  } finally {
    await client.query("ROLLBACK"); client.release();
  }
});

test("Smartphone genera código desde la familia relacionada por ID", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const smartphone = await client.query<{ id: string }>(
      "SELECT id FROM itam.tipos_dispositivo WHERE LOWER(nombre)='smartphone' LIMIT 1"
    );
    const tipo = await resolverTipoActivoParaAlta(
      Number(smartphone.rows[0]!.id), client
    );
    const code = await generateInventoryCodeByFamilyId(
      tipo.familia_codigo_inventario_id!, "DISPOSITIVO", client
    );
    assert.equal(String(code).startsWith("1"), true);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("Mouse y Teclado comparten familia 6 y reciben códigos correlativos", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const family = await client.query<{ id: string }>(
      "SELECT id FROM itam.familias_codigo_inventario WHERE prefijo='6' LIMIT 1"
    );
    const state = await client.query<{ id: string }>(
      "SELECT id FROM itam.estados WHERE tipo_entidad='DISPOSITIVO' AND codigo='DISPONIBLE' LIMIT 1"
    );
    const mouse = await crearTipoDispositivo({ nombre: "TEST Mouse", familiaCodigoInventarioId: Number(family.rows[0]!.id) }, client);
    const keyboard = await crearTipoDispositivo({ nombre: "TEST Teclado", familiaCodigoInventarioId: Number(family.rows[0]!.id) }, client);
    const mouseType = await resolverTipoActivoParaAlta(Number(mouse.id), client);
    const firstCode = await generateInventoryCodeByFamilyId(mouseType.familia_codigo_inventario_id!, "DISPOSITIVO", client);
    assert.equal(firstCode, 6001);
    await client.query(
      "INSERT INTO itam.dispositivos(codigo_inventario,tipo_dispositivo_id,estado_id) VALUES($1,$2,$3)",
      [firstCode, mouse.id, state.rows[0]!.id]
    );
    const secondCode = await generateInventoryCodeByFamilyId(family.rows[0]!.id, "DISPOSITIVO", client);
    assert.equal(secondCode, 6002);
    await client.query(
      "UPDATE itam.dispositivos SET tipo_dispositivo_id=$2 WHERE codigo_inventario=$1",
      [firstCode, keyboard.id]
    );
    const notebook = await client.query<{ id: string }>(
      "SELECT id FROM itam.tipos_dispositivo WHERE LOWER(nombre)='notebook' LIMIT 1"
    );
    await assert.rejects(
      client.query("UPDATE itam.dispositivos SET tipo_dispositivo_id=$2 WHERE codigo_inventario=$1", [firstCode, notebook.rows[0]!.id]),
      (error: unknown) => (error as { code?: string }).code === "P0001"
    );
  } finally {
    await client.query("ROLLBACK"); client.release();
  }
});

test("el catálogo periférico real comparte familia 6 y configuración dinámica", async () => {
  const result = await pool.query<{
    nombre: string;
    prefijo: string;
    agrupa_tipos: boolean;
    etiqueta_operativa: string;
    configuracion_formulario: { camposEspecificos: { clave: string; requerido: boolean }[] };
  }>(`
    SELECT tipo.nombre, familia.prefijo, familia.agrupa_tipos,
      familia.etiqueta_operativa, tipo.configuracion_formulario
    FROM itam.tipos_dispositivo AS tipo
    JOIN itam.familias_codigo_inventario AS familia
      ON familia.id = tipo.familia_codigo_inventario_id
    WHERE tipo.nombre IN ('Mouse','Teclado','Cable','Cargador','Docking Station','Webcam','Adaptador','Hub USB','Otro')
    ORDER BY tipo.nombre
  `);
  assert.equal(result.rows.length, 9);
  assert.equal(result.rows.every((row) => row.prefijo === "6"), true);
  assert.equal(result.rows.every((row) => row.agrupa_tipos), true);
  assert.equal(result.rows.every((row) => row.etiqueta_operativa === "Periférico"), true);
  const keyboard = result.rows.find((row) => row.nombre === "Teclado");
  assert.equal(
    keyboard?.configuracion_formulario.camposEspecificos.some(
      (field) => field.clave === "partNumber"
    ),
    true
  );
  const cable = result.rows.find((row) => row.nombre === "Cable");
  assert.equal(
    cable?.configuracion_formulario.camposEspecificos.some(
      (field) => field.clave === "tipoCable" && field.requerido
    ),
    true
  );
});

test("Cable persiste sus atributos específicos con código automático de familia 6", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cable = await client.query<{ id: string }>(
      "SELECT id FROM itam.tipos_dispositivo WHERE nombre='Cable' LIMIT 1"
    );
    const state = await client.query<{ id: string }>(
      "SELECT id FROM itam.estados WHERE tipo_entidad='DISPOSITIVO' AND codigo='DISPONIBLE' LIMIT 1"
    );
    const tipo = await resolverTipoActivoParaAlta(Number(cable.rows[0]!.id), client);
    const code = await generateInventoryCodeByFamilyId(
      tipo.familia_codigo_inventario_id!, "DISPOSITIVO", client
    );
    const created = await crearDispositivo({
      tipoDispositivoId: Number(cable.rows[0]!.id),
      marca: "TEST",
      atributosEspecificos: { tipoCable: "USB-C", longitud: "2 m" },
      responsable: "TEST"
    }, code, state.rows[0]!.id, client);

    assert.equal(code, 6001);
    assert.equal(created.tipo_dispositivo_nombre, "Cable");
    assert.deepEqual(created.atributos_especificos, {
      tipoCable: "USB-C", longitud: "2 m"
    });
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("PostgreSQL conserva nombres UTF-8 del catálogo", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const nombre of ["PC Escritorio", "Teléfono", "Impresora", "Cámara"]) {
      const creado = await crearTipoDispositivo({ nombre }, client);
      assert.equal(creado.nombre, nombre);
    }
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
