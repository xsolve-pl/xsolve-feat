import { ContextAwareCommand } from './context-aware-command.interface';
import { Injectable } from '@nestjs/common';
import { CommandLogRepository } from '../../persistence/repository/command-log.repository';
import { CommandLogger } from '../logger/command-logger';
import { BaseLogger } from '../../logger/base-logger';
import { CommandExecutorComponent } from './command-executor.component';
import { CommandType } from './command.type';
import { ExecuteCommandError } from '../helper/execute-command-error';

@Injectable()
export class ContextAwareCommandExecutorComponent {
    private commandExecutorComponent: CommandExecutorComponent;

    constructor(
        private readonly commandLogRepository: CommandLogRepository,
        private readonly baseLogger: BaseLogger,
    ) {}

    setCommandExecutorComponent(
        commandExecutorComponent: CommandExecutorComponent,
    ): void {
        this.commandExecutorComponent = commandExecutorComponent;
    }

    async execute(command: ContextAwareCommand): Promise<void> {
        const commandLogger = await this.createCommandLogger(command);
        const wrappedCommand = this.createCommand(command, commandLogger);

        try {
            const result = await this.commandExecutorComponent.execute(
                wrappedCommand,
            );
            if (command.processResult) {
                await command.processResult(result);
            }
            await commandLogger.markAsCompleted();
            commandLogger.info('Command completed.');
        } catch (error) {
            await commandLogger.markAsFailed();

            let messages: string[];
            if (error instanceof ExecuteCommandError) {
                messages = [`Command execution failed.`];
            } else if (error instanceof Error) {
                messages = [
                    `Command execution failed.`,
                    `Error class: ${error.constructor.name}`,
                    `Error message '${error.message}'.`,
                ];
            } else {
                messages = [`Command execution failed.`];
            }

            for (const message of messages) {
                commandLogger.error(message);
            }

            throw error;
        }
    }

    protected async createCommandLogger(
        command: ContextAwareCommand,
    ): Promise<CommandLogger> {
        const commandLog = await command.createCommandLog(
            this.commandLogRepository,
        );

        return new CommandLogger(commandLog, this.baseLogger);
    }

    protected createCommand(
        command: ContextAwareCommand,
        commandLogger: CommandLogger,
    ): CommandType {
        const wrappedCommand = command.createWrappedCommand();
        wrappedCommand.commandLogger = commandLogger;

        return wrappedCommand;
    }
}
