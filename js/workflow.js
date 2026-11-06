(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  root.MBWorkflow = api;
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

  // Copy values saved under an old key to its new key, once, without ever overwriting
  // something already saved under the new key. Old keys are left in place (harmless, and
  // lets an older copy of the page keep working). Returns how many keys were copied.
  function migrateLegacyKeys(storage, keyMap){
    let migrated = 0;
    if(!storage || !keyMap) return migrated;
    Object.keys(keyMap).forEach(oldKey => {
      try{
        const newKey = keyMap[oldKey];
        if(storage.getItem(newKey) !== null) return;
        const value = storage.getItem(oldKey);
        if(value === null) return;
        storage.setItem(newKey, value);
        migrated += 1;
      }catch(error){
        /* storage blocked or full: skip; the page falls back to defaults */
      }
    });
    return migrated;
  }

  return {normalizeMachineProfile, evaluateMachineLimits, migrateLegacyKeys};
});
