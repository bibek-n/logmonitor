//go:build legacy_win7

package main

// Legacy Windows 7 build only (see go.mod.win7's header comment and browserhistory.go's own
// comment) - modernc.org/sqlite isn't pinned into that dependency set, so this collector is
// a no-op there rather than forcing a dependency bump onto an already-narrow legacy build.
// Same "windows-only feature, stub everywhere else" shape as chattray/remotesupport_stub.go.
type browserActivityEventPayload struct {
	Browser      string  `json:"browser"`
	Domain       string  `json:"domain"`
	PageTitle    *string `json:"pageTitle"`
	VisitedAt    string  `json:"visitedAt"`
	DwellSeconds *int    `json:"dwellSeconds"`
}

func CollectBrowserHistory(excludedSuffixes []string) []browserActivityEventPayload {
	return nil
}
