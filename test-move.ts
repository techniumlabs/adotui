import { INITIAL_STATE } from "./src/app/constants";
import { clampPrIndex } from "./src/app/utils";
import { MOCK_DATA } from "./src/data/mock";

const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(max, val));

let current = {
  ...INITIAL_STATE,
  data: MOCK_DATA,
  selectedOrgIndex: 0,
  selectedRepoIndex: 1, // last repo of org 0
  selectedPrIndex: 0,
};

const moveTreeSelection = (orgDelta: number, repoDelta: number) => {
      const filter = current.treeFilter;
      const flatList: { orgIndex: number; repoIndex: number }[] = [];

      current.data.organizations.forEach((org, orgIdx) => {
        const repos = org.repositories;
        let added = false;
        repos.forEach((repo, repoIdx) => {
          if (filter === "all" || repo.pullRequests.length > 0) {
            flatList.push({ orgIndex: orgIdx, repoIndex: repoIdx });
            added = true;
          }
        });
        if (!added) {
          flatList.push({ orgIndex: orgIdx, repoIndex: 0 });
        }
      });

      if (flatList.length === 0) return;

      let currentIndex = flatList.findIndex(
        (item) => item.orgIndex === current.selectedOrgIndex && item.repoIndex === current.selectedRepoIndex
      );
      
      if (currentIndex === -1) {
        currentIndex = flatList.findIndex((item) => item.orgIndex === current.selectedOrgIndex);
        if (currentIndex === -1) currentIndex = 0;
      }

      let nextIndex = currentIndex;

      if (repoDelta !== 0) {
        nextIndex = clamp(currentIndex + repoDelta, 0, flatList.length - 1);
      } else if (orgDelta !== 0) {
        const currentOrgIndex = flatList[currentIndex]!.orgIndex;
        const targetOrgIndex = clamp(currentOrgIndex + orgDelta, 0, current.data.organizations.length - 1);
        
        const nextOrgFirstItemIndex = flatList.findIndex(item => item.orgIndex === targetOrgIndex);
        if (nextOrgFirstItemIndex !== -1) {
          nextIndex = nextOrgFirstItemIndex;
        }
      }

      const { orgIndex: nextOrgIndex, repoIndex: nextRepoIndex } = flatList[nextIndex]!;
      const nextOrg = current.data.organizations[nextOrgIndex];
      const nextRepo = nextOrg?.repositories[nextRepoIndex];

      current = {
        ...current,
        selectedOrgIndex: nextOrgIndex,
        selectedRepoIndex: nextRepoIndex,
        selectedPrIndex: clampPrIndex(nextRepo, current.selectedPrIndex),
      };
};

console.log("INITIAL:", current.selectedOrgIndex, current.selectedRepoIndex);
moveTreeSelection(0, 1); // press 'j'
console.log("AFTER J:", current.selectedOrgIndex, current.selectedRepoIndex);

