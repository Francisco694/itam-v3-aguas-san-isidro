import assert from "node:assert/strict";
import test from "node:test";
import { ValidationError } from "../../shared/errors";
import { normalizeSpecificAttributes } from "../dispositivos/dispositivos.service";
import type { ConfiguracionFormularioTipo } from "../tipos-dispositivo/tipos-dispositivo.types";

const cableConfig: ConfiguracionFormularioTipo = {
  mostrarMarca: true,
  mostrarModelo: true,
  mostrarNumeroSerie: false,
  camposEspecificos: [
    {
      clave: "tipoCable",
      etiqueta: "Tipo de cable",
      tipo: "select",
      requerido: true,
      opciones: ["HDMI", "USB-C"]
    },
    {
      clave: "longitud",
      etiqueta: "Longitud",
      tipo: "text",
      requerido: false,
      maxLength: 50
    }
  ]
};

test("normaliza únicamente atributos configurados para el tipo", () => {
  assert.deepEqual(
    normalizeSpecificAttributes(
      { tipoCable: "HDMI", longitud: " 2 metros " },
      cableConfig
    ),
    { tipoCable: "HDMI", longitud: "2 metros" }
  );
});

test("Cable exige tipo y rechaza opciones no configuradas", () => {
  assert.throws(
    () => normalizeSpecificAttributes({}, cableConfig),
    (error: unknown) => error instanceof ValidationError &&
      error.message === "Tipo de cable es obligatorio."
  );
  assert.throws(
    () => normalizeSpecificAttributes({ tipoCable: "Coaxial" }, cableConfig),
    (error: unknown) => error instanceof ValidationError
  );
});

test("rechaza atributos de otro tipo para evitar datos dispersos", () => {
  assert.throws(
    () => normalizeSpecificAttributes(
      { tipoCable: "HDMI", cantidadPuertos: 4 },
      cableConfig
    ),
    (error: unknown) => error instanceof ValidationError
  );
});
