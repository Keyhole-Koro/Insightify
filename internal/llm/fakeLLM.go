package llm

import (
	"context"
	"encoding/json"
)

// FakeClient returns deterministic, minimal JSON payloads per phase for offline/testing.
type FakeClient struct{}

func NewFakeClient() *FakeClient   { return &FakeClient{} }
func (f *FakeClient) Name() string { return "FakeLLM" }
func (f *FakeClient) Close() error { return nil }

func (f *FakeClient) GenerateJSON(ctx context.Context, prompt string, input any) (json.RawMessage, error) {
	phase := PhaseFrom(ctx)
	var obj any
	switch phase {
	case "m0":
		obj = map[string]any{
			"main_source_roots":    []string{"src", "internal"},
			"library_roots":        []string{"third_party", "vendor"},
			"config_roots":         []string{".github", "scripts"},
			"config_files":         []string{".env.example"},
			"runtime_config_files": []string{},
			"notes":                []string{"fake m0 output"},
		}
	case "m1":
		obj = map[string]any{
			"architecture_hypothesis": map[string]any{
				"purpose":         "fake purpose",
				"summary":         "fake summary",
				"key_components":  []any{},
				"execution_model": "fake",
				"tech_stack": map[string]any{
					"platforms":   []string{},
					"languages":   []string{"Go"},
					"build_tools": []string{"go"},
				},
				"assumptions": []string{},
				"unknowns":    []string{},
				"confidence":  0.5,
			},
			"next_files":     []any{},
			"next_patterns":  []any{},
			"contradictions": []any{},
			"needs_input":    []string{},
			"stop_when":      []string{},
			"notes":          []string{"fake m1 output"},
		}
	case "m2":
		obj = map[string]any{
			"updated_hypothesis": map[string]any{
				"purpose":         "fake purpose",
				"summary":         "fake summary",
				"key_components":  []any{},
				"execution_model": "fake",
				"tech_stack": map[string]any{
					"platforms":   []string{},
					"languages":   []string{"Go"},
					"build_tools": []string{"go"},
				},
				"assumptions":          []string{},
				"unknowns":             []string{},
				"confidence":           0.5,
				"verification_targets": []any{},
			},
			"question_status": []any{},
			"delta":           map[string]any{"added": []string{}, "removed": []string{}, "modified": []any{}},
			"contradictions":  []any{},
			"next_files":      []any{},
			"next_patterns":   []any{},
			"needs_input":     []string{},
			"stop_when":       []string{},
			"notes":           []string{"fake m2 output"},
		}
	case "x0":
		obj = map[string]any{
			"version": 1,
			"specs":   []any{},
		}
	default:
		// generic empty JSON object
		obj = map[string]any{}
	}
	b, _ := json.Marshal(obj)
	return json.RawMessage(b), nil
}
