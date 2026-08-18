database/sql/
├── 000_base.sql
├── organizations/
│   ├── 001_enums.sql
│   ├── 002_organizations.sql
│   ├── 003_organization_requests.sql
│   └── 004_approval_functions.sql
├── user/
│   ├── 001_enums.sql
│   ├── 002_users_table.sql
│   ├── 003_users_indexes.sql
│   ├── 004_users_triggers.sql
│   ├── 005_password_reset.sql
│   ├── 006_email_verification.sql
│   ├── 007_login_security.sql
│   └── 008_cleanup_tokens.sql
├── academic/
│   ├── 001_faculties.sql
│   ├── 002_programs.sql
│   ├── 003_academic_periods.sql
│   ├── 004_voter_registries.sql
│   ├── 005_voter_validation.sql
│   ├── 006_views.sql
│   └── 007_functions.sql
├── elections/
│   ├── 001_enums.sql
│   ├── 002_elections.sql
│   ├── 003_positions.sql
│   ├── 004_candidate_lists.sql
│   ├── 005_candidacies.sql
│   ├── 006_election_rules.sql
│   ├── 007_vote_records.sql
│   └── 008_vote_validation.sql
├── ballots/
│   ├── 001_enums.sql
│   ├── 002_ballots.sql
│   ├── 003_ballot_positions.sql
│   ├── 004_ballot_options.sql
│   ├── 005_views.sql
│   └── 006_functions.sql
├── voting/
│   ├── 001_voting_sessions.sql
│   ├── 002_votes.sql
│   ├── 003_vote_selections.sql
│   ├── 004_start_session.sql
│   └── 005_cast_vote.sql
├── audit/
│   ├── 001_enums.sql
│   ├── 002_audit_logs.sql
│   ├── 003_audit_protection.sql
│   ├── 004_one_time_tokens.sql
│   └── 005_token_consumption.sql
├── results/
│   ├── 001_tallies.sql
│   ├── 002_election_results.sql
│   ├── 003_turnout_trigger.sql
│   └── 004_certify_election.sql