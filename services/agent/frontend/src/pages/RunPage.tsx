import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { RunFormCard } from "@/components/run/RunFormCard";
import { SessionOverviewCard } from "@/components/run/SessionOverviewCard";
import { scenarioOptions } from "@/types/analysis";
import { useAnalysisStore } from "@/store/analysis-store";

export function RunPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = useAnalysisStore((state) => state.mode);
  const job = useAnalysisStore((state) => state.job);
  const scenario = useAnalysisStore((state) => state.scenario);
  const switchMode = useAnalysisStore((state) => state.switchMode);
  const setScenario = useAnalysisStore((state) => state.setScenario);

  useEffect(() => {
    const modeParam = searchParams.get("mode");
    if ((modeParam === "live" || modeParam === "replay") && modeParam !== mode) {
      switchMode(modeParam);
    }
  }, [mode, searchParams, switchMode]);

  useEffect(() => {
    const scenarioParam = searchParams.get("scenario");
    if (scenarioParam && scenarioOptions.includes(scenarioParam) && scenarioParam !== scenario) {
      setScenario(scenarioParam);
    }
  }, [scenario, searchParams, setScenario]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    let changed = false;

    if (nextParams.get("mode") !== mode) {
      nextParams.set("mode", mode);
      changed = true;
    }

    if (nextParams.get("scenario") !== scenario) {
      nextParams.set("scenario", scenario);
      changed = true;
    }

    if (changed) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [mode, scenario, searchParams, setSearchParams]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 pb-3">
      <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[1.04fr_0.96fr]">
        <div className="min-h-0">
          <RunFormCard />
        </div>
        <div className="min-h-0">
          <SessionOverviewCard />
        </div>
      </div>
    </div>
  );
}
