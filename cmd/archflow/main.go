package main

import (
	"context"
	"flag"
	"log"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/joho/godotenv"

	"insightify/internal/llm"

	"insightify/internal/runner"
)

func main() {
	// ----- Flags -----
	repo := flag.String("repo", "", "path to repository root")
	outDir := flag.String("out", "artifacts", "output directory")
	provider := flag.String("provider", "gemini", "LLM provider (gemini|groq)")
	model := flag.String("model", "gemini-2.5-pro", "LLM model id (provider-specific)")
	fake := flag.Bool("fake", false, "use a fake LLM (no network)")
	phase := flag.String("phase", "m0", "phase to run (m0|m1|m2|c0|c1|c2)")
	forceFrom := flag.String("force_from", "", "force recompute starting at this phase (e.g., m0|m1|m2|c0|c1|c2)")
	cache := flag.Bool("cache", false, "use cached artifacts (default: off)")
	maxNext := flag.Int("max_next", 8, "max next_files to open/propose")
	flag.Parse()

	if *repo == "" {
		log.Fatal("--repo is required")
	}
	if err := os.MkdirAll(*outDir, 0o755); err != nil {
		log.Fatal(err)
	}

	// Determine requested phase key and default force behavior when cache is disabled
	key := strings.ToLower(strings.TrimSpace(*phase))
	force := strings.ToLower(strings.TrimSpace(*forceFrom))
	if !*cache && force == "" {
		// Default: do not use cache → force recompute of the requested phase
		force = key
	}

	// ----- LLM setup -----
	_ = godotenv.Load()
	// Defer provider-specific API key checks until after flags are parsed
	apiKey := ""
	ctx := context.Background()

	// Prompt hook persists prompts & raw responses under artifacts/prompt/
	ctx = llm.WithPromptHook(ctx, &runner.PromptSaver{Dir: *outDir})

	var base llm.LLMClient
	var err error
	if *fake {
		base = llm.NewFakeClient()
	} else {
		switch strings.ToLower(strings.TrimSpace(*provider)) {
		case "gemini":
			// Prefer GEMINI_API_KEY for Gemini
			apiKey = os.Getenv("GEMINI_API_KEY")
			if apiKey == "" {
				log.Fatal("GEMINI_API_KEY must be set (or use --fake)")
			}
			base, err = llm.NewGeminiClient(ctx, apiKey, *model)
		case "groq":
			// Prefer GROQ_API_KEY for Groq
			apiKey = os.Getenv("GROQ_API_KEY")
			if apiKey == "" {
				log.Fatal("GROQ_API_KEY must be set (or use --fake)")
			}
			base, err = llm.NewGroqClient(apiKey, *model)
		default:
			log.Fatalf("unknown --provider: %s (use gemini|groq)", *provider)
		}
		if err != nil {
			log.Fatal(err)
		}
	}
	cfg := defaultLLMRateConfig(*provider, *model)
	mws := buildRateMiddlewares(cfg)
	mws = append(mws,
		llm.Retry(3, 300*time.Millisecond),
		llm.WithHooks(),
		llm.WithLogging(nil),
	)
	llmCli := llm.Wrap(base, mws...)
	defer llmCli.Close()

	// Scanning is performed per-phase inside runner.BuildRegistry via PlanScan.

	// ----- Build environment & registry -----
	env := &runner.Env{
		Repo:         *repo,
		OutDir:       *outDir,
		MaxNext:      *maxNext,
		ModelSalt:    os.Getenv("CACHE_SALT") + "|" + *model, // Salt helps invalidate cache when model/prompts change
		ForceFrom:    force,
		LLM:          llmCli,
		Index:        nil,
		MDDocs:       nil,
		StripImgMD:   regexp.MustCompile(`!\[[^\]]*\]\([^)]*\)`),
		StripImgHTML: regexp.MustCompile(`(?is)<img[^>]*>`),
	}

	reg := runner.BuildRegistry(env)       // m0/m1/m2
	for k, v := range runner.BuildX(env) { // x0/x1
		reg[k] = v
	}

	// ----- Execute requested phase -----
	spec, ok := reg[key]
	if !ok {
		log.Fatalf("unknown --phase: %s (use m0|m1|m2|x0|x1|x2)", *phase)
	}
	if err := runner.ExecutePhase(ctx, spec, env, reg); err != nil {
		log.Fatal(err)
	}
}

// LLMRateConfig captures rate limiting in a clear, declarative way.
// Zero values disable the corresponding limiter.
type LLMRateConfig struct {
	RPM   int     // requests per minute
	RPD   int     // requests per day
	TPM   int     // tokens per minute (approximate)
	RPS   float64 // legacy requests per second limiter
	Burst int     // burst for RPS
}

// defaultLLMRateConfig defines built-in rate configs per provider/model.
// Example: {RPM: 60} for clarity instead of positional params.
func defaultLLMRateConfig(provider, model string) LLMRateConfig {
	_ = model
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "gemini":
		return LLMRateConfig{RPM: 60, RPS: 1, Burst: 1}
	case "groq":
		return LLMRateConfig{RPM: 30, RPS: 1, Burst: 1}
	default:
		return LLMRateConfig{RPS: 1, Burst: 1}
	}
}

// buildRateMiddlewares converts LLMRateConfig into the corresponding middlewares.
func buildRateMiddlewares(c LLMRateConfig) []llm.Middleware {
	out := []llm.Middleware{}
	if c.RPM > 0 || c.RPD > 0 || c.TPM > 0 {
		out = append(out, llm.MultiLimit(c.RPM, c.RPD, c.TPM))
	}
	if c.RPS > 0 || c.Burst > 0 {
		out = append(out, llm.RateLimit(c.RPS, c.Burst))
	}
	return out
}
