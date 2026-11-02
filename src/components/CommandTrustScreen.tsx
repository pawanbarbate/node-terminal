import React from 'react';
import { Box, Text, useInput } from 'ink';
import path from 'path';
import { DevPulseConfig, ServiceConfig } from '../types/config.js';
import { normalizeServiceCommands } from '../services/dependencyGraph.js';
import { theme } from '../theme/theme.js';
import { useTerminalViewport } from '../hooks/useTerminalViewport.js';
import TerminalSizeNotice from './TerminalSizeNotice.js';

export interface CommandTrustScreenProps {
  config: DevPulseConfig;
  configPath: string;
  onApprove: () => void;
  onCancel: () => void;
}

function commandsFor(service: ServiceConfig): string[] {
  const pipeline = normalizeServiceCommands(service);
  return [...pipeline.preCommands, ...(pipeline.finalCommand ? [pipeline.finalCommand] : [])];
}

export const CommandTrustScreen: React.FC<CommandTrustScreenProps> = ({
  config,
  configPath,
  onApprove,
  onCancel
}) => {
  const viewport = useTerminalViewport();

  useInput((input, key) => {
    if (key.escape || input === 'q' || input === 'Q') {
      onCancel();
      return;
    }
    if (key.return || input === 'a' || input === 'A') onApprove();
  });

  if (viewport.isTooSmall) {
    return <TerminalSizeNotice width={viewport.width} height={viewport.height} />;
  }

  return (
    <Box
      flexDirection="column"
      width="100%"
      paddingX={2}
      paddingY={1}
      backgroundColor={theme.colors.canvas}
    >
      <Text color={theme.colors.stopped} bold>Review commands before running this profile</Text>
      <Text color={theme.colors.textSecondary}>Config: {configPath}</Text>
      <Text color={theme.colors.warning}>
        Commands run with your user permissions and inherited environment. Review every command before approval.
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {config.services.map(service => (
          <Box key={service.name} flexDirection="column" marginBottom={1}>
            <Text color={theme.colors.accent} bold>
              {service.name}{service.autoStart === false ? ' (manual start)' : ' (starts automatically)'}
            </Text>
            <Text color={theme.colors.textMuted}>Working directory: {path.resolve(process.cwd(), service.path)}</Text>
            {commandsFor(service).map((command, index) => (
              <Text key={`${service.name}-${index}`} color={theme.colors.textPrimary}>
                {index + 1}. {command}
              </Text>
            ))}
            {commandsFor(service).length === 0 && (
              <Text color={theme.colors.textMuted}>No command configured.</Text>
            )}
          </Box>
        ))}
      </Box>

      <Text color={theme.colors.running} bold>[Enter / A] Approve for this session</Text>
      <Text color={theme.colors.textMuted}>[Esc / Q] Cancel without starting services</Text>
    </Box>
  );
};

export default CommandTrustScreen;
