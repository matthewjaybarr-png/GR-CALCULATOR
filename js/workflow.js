(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  root.GRWorkflow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  function finiteNonNegative(value, label){
    const number = Number(value);
    if(!Number.isFinite(number) || number < 0){
      throw new Error(label + " must be zero or a positive number.");
    }
    return number;
  }

  function normalizeMachineProfile(input){
    const source = input || {};
    const name = String(source.name || "").trim();
    if(!name) throw new Error("Enter a machine profile name.");
    const maxRpm = finiteNonNegative(source.maxRpm || 0, "Maximum RPM");
    const maxFeedIpm = finiteNonNegative(source.maxFeedIpm || 0, "Maximum feed");
    if(maxRpm === 0 && maxFeedIpm === 0){
      throw new Error("Enter at least one machine limit.");
    }
    return {
      id: String(source.id || ""),
      name,
      maxRpm,
      maxFeedIpm
    };
  }

  function evaluateMachineLimits(profileInput, values){
    if(!profileInput) return {profile:null, warnings:[], withinLimits:true};
    const profile = normalizeMachineProfile(profileInput);
    const rpm = Number(values && values.rpm);
    const feedIpm = Number(values && values.feedIpm);
    const warnings = [];
    if(profile.maxRpm > 0 && Number.isFinite(rpm) && rpm > profile.maxRpm){
      warnings.push({
        type:"rpm",
        actual:rpm,
        limit:profile.maxRpm,
        message:"Calculated RPM exceeds the saved spindle limit."
      });
    }
    if(profile.maxFeedIpm > 0 && Number.isFinite(feedIpm) && feedIpm > profile.maxFeedIpm){
      warnings.push({
        type:"feed",
        actual:feedIpm,
        limit:profile.maxFeedIpm,
        message:"Calculated feed exceeds the saved feed limit."
      });
    }
    return {profile, warnings, withinLimits:warnings.length === 0};
  }

  return {normalizeMachineProfile, evaluateMachineLimits};
});
