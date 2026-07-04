import { INITIAL_STATE } from "./src/app/constants";
import { clampPrIndex } from "./src/app/utils";
import { MOCK_DATA } from "./src/data/mock";

const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(max, val));

let current = {
  ...INITIAL_STATE,
  data: MOCK_DATA,
  selectedOrgIndex: 0,
  selectedRepoIndex: 0,
  selectedPrIndex: 0,
};

const moveTreeSelection = (orgDelta: number, repoDelta: number) => {
      const nextOrgIndex = clamp(
        current.selectedOrgIndex + orgDelta,
        0,
        current.data.organizations.length - 1,
      );
      const nextOrg = current.data.organizations[nextOrgIndex];
      const repos = nextOrg?.repositories ?? [];
      const filter = current.treeFilter;
      const isValid = (idx: number) => filter === "all" || (repos[idx] && repos[idx]!.pullRequests.length > 0);

      let nextRepoIndex = current.selectedRepoIndex;

      if (orgDelta !== 0) {
        if (!isValid(nextRepoIndex)) {
          const anyValid = repos.findIndex((_, i) => isValid(i));
          nextRepoIndex = anyValid !== -1 ? anyValid : 0;
        }
      } else if (repoDelta !== 0) {
        let temp = nextRepoIndex + (repoDelta > 0 ? 1 : -1);
        let found = -1;
        while (temp >= 0 && temp < repos.length) {
          if (isValid(temp)) {
            found = temp;
            break;
          }
          temp += (repoDelta > 0 ? 1 : -1);
        }
        if (found !== -1) {
          nextRepoIndex = found;
        } else if (!isValid(nextRepoIndex)) {
          const anyValid = repos.findIndex((_, i) => isValid(i));
          nextRepoIndex = anyValid !== -1 ? anyValid : 0;
        }
      }

      nextRepoIndex = clamp(nextRepoIndex, 0, Math.max(0, repos.length - 1));
      const nextRepo = repos[nextRepoIndex];

      current = {
        ...current,
        selectedOrgIndex: nextOrgIndex,
        selectedRepoIndex: nextRepoIndex,
        selectedPrIndex: clampPrIndex(nextRepo, current.selectedPrIndex),
      };
};

console.log("INITIAL:", current.selectedOrgIndex, current.selectedRepoIndex);
moveTreeSelection(1, 0); // press 'l'
console.log("AFTER L:", current.selectedOrgIndex, current.selectedRepoIndex);
moveTreeSelection(0, 1); // press 'j'
console.log("AFTER J:", current.selectedOrgIndex, current.selectedRepoIndex);

