export interface ClipboardService {
  writeText(value: string): Promise<void>;
}
