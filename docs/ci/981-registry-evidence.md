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

[Controlled after evidence](981-controlled-after.json) records actual jobs and
seconds on `3d9efe3cdc2b3ae3fcf2eddfbdebb04b238a9eb5`:
[fresh full producer](https://github.com/Matysh/houseplan-card/actions/runs/39561557339)
cost 83.20 machine minutes;
[full candidate validation](https://github.com/Matysh/houseplan-card/actions/runs/39561608307)
cost 8.70. All six product job families were authenticated and inherited; fresh
packaging, HACS/Hassfest, filesystem/range checks, backend manifest validation
and the actual assembled-bundle smoke succeeded. The real proof consumer
accepted the complete full policy. Registry lookup cost 13 job seconds.

The earlier short pair cost 14.42 and 8.95 machine minutes, with lookup taking
10 job seconds. A real local `git push --dry-run` on a private documentation-only
commit authenticated the same registry and passed its blocking gate in 154 s;
that branch was not published. These are controlled observations, not a claim
about an unobserved post-change traffic week.

Diagnostic run 39557393281 is retained as a rejected observation: GitHub called
it successful, but frontend skip propagation also skipped mandatory fresh
guards. The actual proof consumer refused it. Explicit dependency-success
conditions now keep fresh consumers and stand publication runnable after reuse;
stand publication also waits for the fresh guards. Its pre-optimization lookup
cost 17 job seconds; the accepted implementation measured 10 and 13 seconds.
