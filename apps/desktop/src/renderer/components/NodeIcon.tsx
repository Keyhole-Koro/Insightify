import React from "react";
import type { FlowNodeKind } from "@insightify/graph-domain";
import {
  FolderTree,
  Globe,
  AppWindow,
  Cpu,
  Database,
  FastForward,
  ShieldCheck,
  GitBranch,
  Cloud,
  Layers,
  Workflow,
} from "lucide-react";

interface NodeIconProps {
  kind: FlowNodeKind;
  technology?: string;
  className?: string;
  size?: number;
}

export function NodeIcon({ kind, technology, className = "", size = 16 }: NodeIconProps) {
  // If a specific technology / cloud is provided or matched in tags
  const techKey = technology?.toLowerCase().trim();

  if (techKey) {
    if (techKey.includes("aws") || techKey.includes("amazon")) {
      return <AwsIcon size={size} className={className} />;
    }
    if (techKey.includes("gcp") || techKey.includes("google") || techKey.includes("bigquery") || techKey.includes("cloud-run")) {
      return <GcpIcon size={size} className={className} />;
    }
    if (techKey.includes("azure") || techKey.includes("microsoft")) {
      return <AzureIcon size={size} className={className} />;
    }
    if (techKey.includes("docker")) {
      return <DockerIcon size={size} className={className} />;
    }
    if (techKey.includes("k8s") || techKey.includes("kubernetes")) {
      return <KubernetesIcon size={size} className={className} />;
    }
    if (techKey.includes("postgres") || techKey.includes("pg") || techKey.includes("sql")) {
      return <PostgreSqlIcon size={size} className={className} />;
    }
    if (techKey.includes("redis") || techKey.includes("cache")) {
      return <RedisIcon size={size} className={className} />;
    }
    if (techKey.includes("openai") || techKey.includes("gpt") || techKey.includes("llm") || techKey.includes("ai")) {
      return <OpenAiIcon size={size} className={className} />;
    }
    if (techKey.includes("stripe") || techKey.includes("payment")) {
      return <StripeIcon size={size} className={className} />;
    }
    if (techKey.includes("github") || techKey.includes("git")) {
      return <GitHubIcon size={size} className={className} />;
    }
  }

  // Lucide icon fallback by kind
  switch (kind) {
    case "room":
      return <FolderTree size={size} className={className} />;
    case "api":
      return <Globe size={size} className={className} />;
    case "ui":
      return <AppWindow size={size} className={className} />;
    case "service":
    case "process":
      return <Workflow size={size} className={className} />;
    case "database":
    case "data":
      return <Database size={size} className={className} />;
    case "queue":
      return <FastForward size={size} className={className} />;
    case "auth":
      return <ShieldCheck size={size} className={className} />;
    case "decision":
      return <GitBranch size={size} className={className} />;
    case "external":
      return <Cloud size={size} className={className} />;
    default:
      return <Layers size={size} className={className} />;
  }
}

// Brand SVGs
export function AwsIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="AWS">
      <path d="M18.75 14.28c-.37-.47-.98-.78-1.78-.78-.58 0-1.12.16-1.54.43-.43.27-.67.62-.67 1.05 0 .42.21.75.6.96.42.22 1 .33 1.7.33.67 0 1.22-.16 1.63-.45.41-.3.62-.69.62-1.14v-.4h-.56zm1.75-2.02v5.7h-1.25v-.95c-.44.4-1 .69-1.63.85-.62.16-1.28.24-1.95.24-.96 0-1.79-.21-2.45-.63-.66-.42-1-.99-1-1.71 0-.82.39-1.48 1.15-1.94.76-.46 1.83-.69 3.14-.69h2.74v-.33c0-.67-.2-1.17-.61-1.47-.41-.3-.98-.46-1.7-.46-.57 0-1.1.1-1.58.29-.48.2-.87.46-1.15.8l-.94-.86c.4-.48.95-.86 1.64-1.13.69-.27 1.48-.41 2.34-.41 1.21 0 2.14.27 2.76.81.62.54.94 1.34.94 2.37l-.01.12zM2.87 18.06l3.34-11.2h1.61l3.36 11.2H9.86l-.75-2.77H5.66l-.77 2.77H2.87zm3.17-4.14h2.73l-1.32-4.9-1.41 4.9zm16.48 3.52c-2.41 1.77-5.5 2.73-8.52 2.73-4.25 0-8.08-1.74-10.97-4.63l.97-.97c2.63 2.64 6.13 4.22 10 4.22 2.75 0 5.56-.87 7.76-2.49l.76 1.14z"/>
    </svg>
  );
}

export function GcpIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="GCP">
      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z"/>
    </svg>
  );
}

export function AzureIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Azure">
      <path d="M13.05 4.24l-5.63 7.82 4.42 4.96H4.27L2 20.02h9.72l9.72-13.68-8.39-2.1zM13.3 17.5l2.42-3.48 4.77 5.96h-6.2l-.99-2.48z"/>
    </svg>
  );
}

export function DockerIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Docker">
      <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.186v1.887c0 .102.083.185.185.185zm-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185zm0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186zm-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186zm-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186zm5.893 2.714h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185zm-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.186v1.887c0 .102.083.185.185.185zm-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186H5.136a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185zm-2.928 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.185-.186H2.208a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185zM23.99 12.3c-.328-.204-1.31-.383-2.483-.07-1.127.297-1.848.966-2.167 1.344-.15-.098-.31-.19-.481-.274l-.19-.092-.208.038c-.808.147-2.316.326-3.805.326H.272a.272.272 0 00-.272.273v1.834c0 3.73 3.037 6.767 6.767 6.767 4.908 0 8.948-2.616 11.238-6.726 1.488.082 3.824-.132 5.586-2.072.247-.272.417-.557.417-.557l-.018-.79z"/>
    </svg>
  );
}

export function KubernetesIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Kubernetes">
      <path d="M11.644 1.055a.8.8 0 00-.472.155L3.39 6.84a.8.8 0 00-.39.68v9.96c0 .28.147.538.39.68l7.782 5.63a.8.8 0 00.944 0l7.782-5.63a.8.8 0 00.39-.68V7.52a.8.8 0 00-.39-.68l-7.782-5.63a.8.8 0 00-.472-.155zm.356 2.05l6.38 4.613-2.182 1.58-4.198-3.038v-3.155zm-1.074.02v3.136L6.728 9.3l-2.182-1.58 6.38-4.614zM4.6 9.44l2.18 1.578v5.964L4.6 15.404V9.44zm14.8 0v5.964l-2.18 1.578v-5.964l2.18-1.578zM12 9.774l3.197 2.313-1.22 3.758H9.988l-1.22-3.758 3.232-2.313zm-3.834 6.772h7.668l2.182 1.58-6.016 4.35-6.016-4.35 2.182-1.58z"/>
    </svg>
  );
}

export function PostgreSqlIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="PostgreSQL">
      <path d="M12.012 2.004c-5.523 0-10 4.477-10 10 0 4.418 2.865 8.167 6.84 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022.012 12c0-5.523-4.477-10-10-10z"/>
    </svg>
  );
}

export function RedisIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Redis">
      <path d="M21.573 7.808c.569-.328.569-.861 0-1.19L12.75 1.5c-.569-.328-1.493-.328-2.062 0L1.865 6.618c-.569.328-.569.861 0 1.19l8.823 5.118c.569.328 1.493.328 2.062 0l8.823-5.118zM1.865 10.873c-.569.328-.569.862 0 1.19l8.823 5.118c.569.328 1.493.328 2.062 0l8.823-5.118c.569-.328.569-.862 0-1.19l-2.062-1.197-7.792 4.52c-.569.328-1.493.328-2.062 0L1.865 10.873zM1.865 15.064c-.569.328-.569.862 0 1.19l8.823 5.118c.569.328 1.493.328 2.062 0l8.823-5.118c.569-.328.569-.862 0-1.19l-2.062-1.197-7.792 4.52c-.569.328-1.493.328-2.062 0L1.865 15.064z"/>
    </svg>
  );
}

export function OpenAiIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="OpenAI">
      <path d="M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 0010.83.692a6.046 6.046 0 00-5.772 3.99 6.035 6.035 0 00-4.004 2.9 6.044 6.044 0 00.74 7.174 5.98 5.98 0 00.51 4.911 6.051 6.051 0 006.515 2.9A5.985 5.985 0 0013.26 24a6.056 6.056 0 005.772-4.208 5.99 5.99 0 003.997-2.9 6.056 6.056 0 00-.747-7.071zM13.26 22.43a4.476 4.476 0 01-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 00.392-.681v-6.737l2.02 1.168a.071.071 0 01.038.052v5.583a4.504 4.504 0 01-4.494 4.494zM3.6 18.304a4.47 4.47 0 01-.535-3.014l.142.085 4.783 2.759a.771.771 0 00.78 0l5.843-3.369v2.332a.08.08 0 01-.033.062L9.74 19.95a4.5 4.5 0 01-6.14-1.646zm-1.8-9.09a4.484 4.484 0 012.368-2.001l-.004.163v5.517a.78.78 0 00.393.681l5.843 3.37-2.02 1.168a.076.076 0 01-.071 0l-4.83-2.786A4.504 4.504 0 011.8 9.213zm16.597 3.855l-5.843-3.372 2.02-1.168a.076.076 0 01.071 0l4.83 2.791a4.494 4.494 0 01-.676 8.105v-5.677a.79.79 0 00-.402-.679zm2.01-4.496l-.142-.085-4.783-2.759a.771.771 0 00-.78 0L8.859 9.097V6.765a.08.08 0 01.033-.062l4.84-2.787a4.5 4.5 0 016.675 4.887zM8.307 13.88l2.885-1.664 2.884 1.664v3.328l-2.884 1.664-2.885-1.664z"/>
    </svg>
  );
}

export function StripeIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Stripe">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
    </svg>
  );
}

export function GitHubIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="GitHub">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  );
}
