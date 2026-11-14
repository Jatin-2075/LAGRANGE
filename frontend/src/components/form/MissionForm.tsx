import { useState, type FormEvent } from "react";
import type { MissionRequest } from "../../api/types";
import {
  RISK_OPTIONS,
  SURFACE_OPTIONS,
  VEHICLE_OPTIONS,
  areaToDiameter,
  buildMission,
  parseNumber,
  validateForm,
  type FormErrors,
  type MissionFormState,
} from "../../lib/mission";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { CheckboxField, FieldRow, FormSection, SelectField, SliderField, TextField } from "./Fields";
import "./MissionForm.css";

interface MissionFormProps {
  value: MissionFormState;
  onChange: (patch: Partial<MissionFormState>) => void;
  onSubmit: (request: MissionRequest) => void;
  loading: boolean;
}

export function MissionForm({ value, onChange, onSubmit, loading }: MissionFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const errors: FormErrors = submitted ? validateForm(value) : {};

  const flatArea = parseNumber(value.minFlatAreaM2);
  const flatAreaDiameter = Number.isFinite(flatArea) && flatArea > 0 ? areaToDiameter(flatArea) : null;
  const preview = Object.keys(validateForm(value)).length === 0 ? buildMission(value) : null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateForm(value)).length > 0) return;
    onSubmit(buildMission(value).request);
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form className="mission-form" onSubmit={handleSubmit} noValidate>
      <div className="mission-form__scroll">
        <div className="mission-form__intro">
          <p className="eyebrow">Mission input</p>
          <h2 className="mission-form__title">Landing-site search</h2>
        </div>

        <FormSection title="Target area" description="Click the globe to set the point, or type coordinates.">
          <TextField label="Target name" value={value.targetName} onChange={(v) => onChange({ targetName: v })} error={errors.targetName} maxLength={200} />
          <FieldRow>
            <TextField label="Latitude" unit="deg" kind="number" value={value.latitude} onChange={(v) => onChange({ latitude: v })} error={errors.latitude} />
            <TextField label="Longitude" unit="deg" kind="number" value={value.longitude} onChange={(v) => onChange({ longitude: v })} error={errors.longitude} />
          </FieldRow>
          <TextField
            label="Search radius"
            unit="km"
            kind="number"
            value={value.searchRadiusKm}
            onChange={(v) => onChange({ searchRadiusKm: v })}
            error={errors.searchRadiusKm}
            hint={
              preview
                ? `Searches lat ${preview.window.region.latitude_min}° to ${preview.window.region.latitude_max}°, lon ${preview.window.region.longitude_min}° to ${preview.window.region.longitude_max}°`
                : undefined
            }
          />
        </FormSection>

        <FormSection title="Mandatory constraints" description="These are pass/fail safety gates. Preferences cannot override them.">
          <FieldRow>
            <TextField label="Maximum slope" unit="deg" kind="number" value={value.maxSlopeDeg} onChange={(v) => onChange({ maxSlopeDeg: v })} error={errors.maxSlopeDeg} />
            <TextField label="Maximum roughness" unit="m" kind="number" value={value.maxRoughnessM} onChange={(v) => onChange({ maxRoughnessM: v })} error={errors.maxRoughnessM} />
          </FieldRow>
          <TextField label="Minimum landing diameter" unit="m" kind="number" value={value.minLandingDiameterM} onChange={(v) => onChange({ minLandingDiameterM: v })} error={errors.minLandingDiameterM} />
          <CheckboxField label="Avoid detected craters and hazards" checked={value.avoidCraters} onChange={(v) => onChange({ avoidCraters: v })} />
          <TextField
            label="Minimum flat area"
            tag="(legacy preference)"
            unit="m²"
            kind="number"
            placeholder="Optional"
            value={value.minFlatAreaM2}
            onChange={(v) => onChange({ minFlatAreaM2: v })}
            error={errors.minFlatAreaM2}
            hint={flatAreaDiameter ? `Treated as a ${flatAreaDiameter.toFixed(0)} m minimum diameter` : undefined}
          />
        </FormSection>

        <FormSection title="Scoring preferences" description="Preferences change ranking only after all mandatory constraints pass.">
          <SliderField label="Sunlight preference" value={value.sunlight} onChange={(v) => onChange({ sunlight: v })} />
          <SliderField label="Resource proximity preference" value={value.resourceProximity} onChange={(v) => onChange({ resourceProximity: v })} />
        </FormSection>

        <div className="mission-form__profile">
          <FieldRow>
            <SelectField label="Vehicle type" value={value.vehicleType} options={VEHICLE_OPTIONS} onChange={(v) => onChange({ vehicleType: v })} />
            <SelectField label="Surface preference" value={value.surfacePreference} options={SURFACE_OPTIONS} onChange={(v) => onChange({ surfacePreference: v })} />
          </FieldRow>
          <FieldRow>
            <SelectField label="Risk tolerance" value={value.riskTolerance} options={RISK_OPTIONS} onChange={(v) => onChange({ riskTolerance: v })} />
            <TextField label="Results to return" kind="number" value={value.topK} onChange={(v) => onChange({ topK: v })} error={errors.topK} />
          </FieldRow>
          <p className="mission-form__note">Risk tolerance changes ranking emphasis. Vehicle and surface preference are recorded for mission context until matching datasets are available.</p>
        </div>
      </div>

      <div className="mission-form__footer">
        {hasErrors ? <Banner tone="error" compact title="Fix the highlighted fields to continue." /> : null}
        <Button type="submit" loading={loading} trailing="→">
          {loading ? "Analysing terrain" : "Find landing sites"}
        </Button>
      </div>
    </form>
  );
}
