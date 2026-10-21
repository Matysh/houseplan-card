# Portable CI proof evidence (#981)

The 14–20 October UTC population contains 113 ordinary dev push runs and 12
beta-candidate validation push runs. Candidate intent comes from the canonical
Release trailer of the actual source commit, not a subject/title proxy. The
ordinary population does not pretend to identify the merge range without its
event base. All 12 candidate runs and 35 evenly spaced ordinary dev runs were
measured: 667.83 and 293.88 machine minutes respectively. Job seconds are summed
for non-skipped jobs, including failed/cancelled attempts, without billing
rounding. Twelve runs do not mean twelve released betas.

[Immutable before run IDs, source commits and job seconds](981-before-week.json)
retain the measurement population/method. After measurements will name real
full producers and actual inherited/candidate validation runs. A future week of
post-change traffic cannot be observed during authoring and is not claimed.
The automatic S8 merge is the first authorized dev push carrying this feature;
its CI and a full canonical check on that exact accepted dev SHA are observed
after the independent reviewer authorizes the merge.
