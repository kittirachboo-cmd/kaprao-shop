"use client";

import { useState } from "react";
import { BANGKOK, areasByZip, type BkkArea } from "@/lib/bangkok";

const input =
  "w-full rounded-lg border border-line bg-white px-3 py-2.5 focus:border-basil focus:outline-none";

const areaLabel = (a: BkkArea) => `แขวง${a.khwaeng} · เขต${a.khet}`;

/**
 * ที่อยู่จัดส่ง (ส่งเฉพาะกรุงเทพฯ)
 * พิมพ์รหัสไปรษณีย์ → ขึ้นแขวง/เขตให้เลือก หรือกด "เลือกเขตเอง" ถ้าจำรหัสไม่ได้
 * ส่งค่าออกไปเป็น hidden input: addr_khet, addr_khwaeng, addr_zip
 */
export function AddressFields() {
  const [zip, setZip] = useState("");
  const [area, setArea] = useState<BkkArea | null>(null);
  const [manual, setManual] = useState(false);
  const [khet, setKhet] = useState("");

  const matches = zip.length === 5 ? areasByZip(zip) : [];
  const khwaengs = BANGKOK.find(([k]) => k === khet)?.[1] ?? [];

  function onZip(v: string) {
    const z = v.replace(/\D/g, "").slice(0, 5);
    setZip(z);
    const m = z.length === 5 ? areasByZip(z) : [];
    setArea(m.length === 1 ? m[0] : null);
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">ที่อยู่จัดส่ง (ส่งเฉพาะกรุงเทพฯ)</legend>

      <textarea
        name="address"
        required
        minLength={5}
        maxLength={250}
        rows={2}
        autoComplete="address-line1"
        placeholder="บ้านเลขที่ หมู่บ้าน/คอนโด ซอย ถนน จุดสังเกต"
        aria-label="บ้านเลขที่ ซอย ถนน"
        className={input}
      />

      {!manual ? (
        <div className="grid grid-cols-[8rem_1fr] gap-2 items-start">
          <label className="block">
            <span className="sr-only">รหัสไปรษณีย์</span>
            <input
              value={zip}
              onChange={(e) => onZip(e.target.value)}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="รหัสไปรษณีย์"
              className={`${input} tabular-nums`}
            />
          </label>

          {matches.length > 1 ? (
            <select
              required
              aria-label="แขวง / เขต"
              className={input}
              value={area ? areaLabel(area) : ""}
              onChange={(e) =>
                setArea(matches.find((a) => areaLabel(a) === e.target.value) ?? null)
              }
            >
              <option value="" disabled>
                เลือกแขวง ({matches.length} แขวง)
              </option>
              {matches.map((a) => (
                <option key={areaLabel(a)} value={areaLabel(a)}>
                  {areaLabel(a)}
                </option>
              ))}
            </select>
          ) : (
            <p
              className={`rounded-lg px-3 py-2.5 text-sm ${
                area
                  ? "bg-basil-soft text-basil font-semibold"
                  : zip.length === 5
                    ? "border border-chili text-chili"
                    : "text-muted"
              }`}
              aria-live="polite"
            >
              {area
                ? areaLabel(area)
                : zip.length === 5
                  ? "ไม่พบรหัสนี้ในกรุงเทพฯ ตอนนี้ร้านส่งเฉพาะกรุงเทพฯ"
                  : "ใส่ 5 หลัก แล้วแขวง/เขตจะขึ้นเอง"}
            </p>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          <select
            required
            aria-label="เขต"
            className={input}
            value={khet}
            onChange={(e) => {
              setKhet(e.target.value);
              setArea(null);
            }}
          >
            <option value="" disabled>
              เลือกเขต
            </option>
            {BANGKOK.map(([k]) => (
              <option key={k} value={k}>
                เขต{k}
              </option>
            ))}
          </select>
          <select
            required
            aria-label="แขวง"
            className={input}
            disabled={!khet}
            value={area?.khwaeng ?? ""}
            onChange={(e) => {
              const hit = khwaengs.find(([w]) => w === e.target.value);
              setArea(hit ? { khet, khwaeng: hit[0], zip: hit[1] } : null);
            }}
          >
            <option value="" disabled>
              เลือกแขวง
            </option>
            {khwaengs.map(([w, z]) => (
              <option key={w} value={w}>
                แขวง{w} ({z})
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="button"
        className="text-sm text-basil underline underline-offset-4"
        onClick={() => {
          setManual((m) => !m);
          setArea(null);
          setZip("");
          setKhet("");
        }}
      >
        {manual ? "กรอกด้วยรหัสไปรษณีย์แทน" : "จำรหัสไปรษณีย์ไม่ได้? เลือกเขตเอง"}
      </button>

      <input type="hidden" name="addr_khet" value={area?.khet ?? ""} />
      <input type="hidden" name="addr_khwaeng" value={area?.khwaeng ?? ""} />
      <input type="hidden" name="addr_zip" value={area?.zip ?? ""} />
    </fieldset>
  );
}
