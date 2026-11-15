import { useState, type FormEvent } from "react";
import type { MissionRequest } from "../../api/types";
import {
  RISK_OPTIONS,
  SURFACE_OPTIONS,
  VEHICLE_OPTIONS,
  buildMission,
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
          <p className="eyebrow">Mission designer</p>
          <h2 className="mission-form__title">Plan your landing</h2>
          <p className="mission-form__lead">Tell us what you are flying. The planner screens terrain against your spacecraft's landing envelope.</p>
        </div>

        <FormSection title="Mission">
          <TextField label="Mission name" value={value.targetName} onChange={(v) => onChange({ targetName: v })} error={errors.targetName} maxLength={200} />
          <FieldRow>
            <SelectField label="Vehicle role" value={value.vehicleType} options={VEHICLE_OPTIONS} onChange={(v) => onChange({ vehicleType: v })} />
            <SelectField label="Risk posture" value={value.riskTolerance} options={RISK_OPTIONS} onChange={(v) => onChange({ riskTolerance: v })} />
          </FieldRow>
          <TextField label="Mission duration" unit="days" kind="number" value={value.missionDurationDays} onChange={(v) => onChange({ missionDurationDays: v })} error={errors.missionDurationDays} />
        </FormSection>

        <FormSection title="Spacecraft">
          <TextField label="Spacecraft name" value={value.spacecraftName} onChange={(v) => onChange({ spacecraftName: v })} error={errors.spacecraftName} maxLength={120} />
          <FieldRow>
            <TextField label="Dry mass" unit="kg" kind="number" value={value.dryMassKg} onChange={(v) => onChange({ dryMassKg: v })} error={errors.dryMassKg} />
            <TextField label="Payload" unit="kg" kind="number" value={value.payloadMassKg} onChange={(v) => onChange({ payloadMassKg: v })} error={errors.payloadMassKg} />
          </FieldRow>
          <FieldRow>
            <TextField label="Propellant" unit="kg" kind="number" value={value.propellantMassKg} onChange={(v) => onChange({ propellantMassKg: v })} error={errors.propellantMassKg} />
            <TextField label="Landing footprint" unit="m" kind="number" value={value.landingFootprintDiameterM} onChange={(v) => onChange({ landingFootprintDiameterM: v })} error={errors.landingFootprintDiameterM} />
          </FieldRow>
          <p className="mission-form__helper">Mass and propellant create a landing reserve score. Footprint, slope and roughness become spacecraft-specific gates.</p>
        </FormSection>

        <FormSection title="Landing zone" description="Click the Moon to set the centre, or enter coordinates.">
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
                ? `lat ${preview.window.region.latitude_min}° to ${preview.window.region.latitude_max}° · lon ${preview.window.region.longitude_min}° to ${preview.window.region.longitude_max}°`
                : undefined
            }
          />
        </FormSection>

        <FormSection title="Terrain limits" description="The tighter of your mission limit and spacecraft limit is applied to every footprint.">
          <FieldRow>
            <TextField label="Maximum slope" unit="deg" kind="number" value={value.maxSlopeDeg} onChange={(v) => onChange({ maxSlopeDeg: v })} error={errors.maxSlopeDeg} />
            <TextField label="Maximum roughness" unit="m" kind="number" value={value.maxRoughnessM} onChange={(v) => onChange({ maxRoughnessM: v })} error={errors.maxRoughnessM} />
          </FieldRow>
          <FieldRow>
            <TextField label="Craft slope limit" unit="deg" kind="number" value={value.spacecraftMaxSlopeDeg} onChange={(v) => onChange({ spacecraftMaxSlopeDeg: v })} error={errors.spacecraftMaxSlopeDeg} />
            <TextField label="Craft roughness limit" unit="m" kind="number" value={value.spacecraftMaxRoughnessM} onChange={(v) => onChange({ spacecraftMaxRoughnessM: v })} error={errors.spacecraftMaxRoughnessM} />
          </FieldRow>
          <TextField label="Minimum landing diameter" unit="m" kind="number" value={value.minLandingDiameterM} onChange={(v) => onChange({ minLandingDiameterM: v })} error={errors.minLandingDiameterM} />
          <CheckboxField label="Avoid detected craters and hazards" checked={value.avoidCraters} onChange={(v) => onChange({ avoidCraters: v })} />
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
          <p className="mission-form__note">Every recommendation is deterministic: it is derived from the loaded terrain, your hard limits, and your spacecraft capability.</p>
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
