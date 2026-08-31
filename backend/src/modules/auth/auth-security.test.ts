import assert from "node:assert/strict";
import test from "node:test";
import {
  credentialChangeEndpointAllowed,
  mustRestrictForCredentialChange
} from "../../shared/auth.middleware";
import { isPasswordLoginBlocked } from "./auth.service";

test("P1-09: con credenciales pendientes solo se permiten endpoints minimos", () => {
  assert.equal(credentialChangeEndpointAllowed("GET", "/api/v1/auth/me"), true);
  assert.equal(credentialChangeEndpointAllowed("POST", "/api/v1/auth/change-password"), true);
  assert.equal(credentialChangeEndpointAllowed("POST", "/api/v1/auth/change-pin"), true);
  assert.equal(credentialChangeEndpointAllowed("POST", "/api/v1/auth/logout"), true);
  assert.equal(credentialChangeEndpointAllowed("GET", "/api/v1/dispositivos"), false);
  assert.equal(credentialChangeEndpointAllowed("POST", "/api/v1/usuarios"), false);
  assert.equal(mustRestrictForCredentialChange({
    debeCambiarPassword:true,debeCambiarPin:false
  },"GET","/api/v1/dispositivos"),true);
  assert.equal(mustRestrictForCredentialChange({
    debeCambiarPassword:false,debeCambiarPin:false
  },"GET","/api/v1/dispositivos"),false);
});

test("P1-09: cinco fallos de password activan el bloqueo temporal", () => {
  assert.equal(isPasswordLoginBlocked(4), false);
  assert.equal(isPasswordLoginBlocked(5), true);
  assert.equal(isPasswordLoginBlocked(6), true);
});
