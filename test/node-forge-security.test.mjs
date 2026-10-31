import { expect, test } from "bun:test";
import forge from "node-forge";
import { BigInteger } from "node-forge/lib/jsbn";

const { asn1, pki, util } = forge;
const digest = util.hexToBytes("00".repeat(32));
const oid = asn1.create(
  asn1.Class.UNIVERSAL,
  asn1.Type.OID,
  false,
  asn1.oidToDer(forge.oids.sha256).getBytes()
);
const nullParameters = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, "");
const extra = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, "garbage");
const digestValue = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, digest);
const publicKey = pki.setRsaPublicKey(new BigInteger("f".repeat(512), 16), new BigInteger("1", 10));

function signatureWith(children) {
  const algorithm = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, children);
  const info = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    algorithm,
    digestValue
  ]);
  const der = asn1.toDer(info).getBytes();
  return "\x00\x01" + "\xff".repeat(256 - der.length - 3) + "\x00" + der;
}

test("node-forge accepts a canonical DigestAlgorithm", () => {
  expect(publicKey.verify(digest, signatureWith([oid, nullParameters]))).toBe(true);
  expect(publicKey.verify(digest, signatureWith([oid]))).toBe(true);
});

test("node-forge rejects unconsumed nested DigestAlgorithm elements", () => {
  expect(() => publicKey.verify(digest, signatureWith([oid, nullParameters, extra]))).toThrow(
    "DigestInfo"
  );
});
