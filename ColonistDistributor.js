/**
 * @class ColonistDistributor
 * @description Manages the automatic distribution of colonists to various tasks within the Mars colony
 */
class ColonistDistributor {
    constructor(logic) {
        this.logic = logic
        this.colonists = logic.populationGroup
        this.buildings = logic.buildingsGroup
        this.priorities = new Map()
        this.workloadStats = new Map()
        console.info('[INFO] ColonistDistributor initialized')
    }

    autoDistributeColonists() {
        console.info('[INFO] Starting colonist distribution...')
        const freeColonists = this.getFreeColonists()
        const tasks = this.getAvailableTasks()

        console.info(`[INFO] Found ${freeColonists.length} free colonists`)
        console.info(`[INFO] Available tasks: ${Object.keys(tasks).join(', ')}`)

        const prioritizedTasks = this.prioritizeTasks(tasks)

        for (const colonist of freeColonists) {
            const bestTask = this.findBestTaskForColonist(colonist, prioritizedTasks)
            if (bestTask) {
                this.assignColonistToTask(colonist, bestTask)
                console.info(`[INFO] Assigned colonist ${colonist.id} to ${bestTask.type} task`)
            } else {
                console.warn(`[WARN] No suitable task found for colonist ${colonist.id}`)
            }
        }
        console.info('[INFO] Colonist distribution completed')
    }

    getFreeColonists() {
        const freeColonists = this.colonists.filter(colonist => colonist.isFree())
        console.info(`[INFO] Getting free colonists. Count: ${freeColonists.length}`)
        return freeColonists
    }

    getAvailableTasks() {
        try {
            const tasks = {
                mining: this.getMiningTasks(),
                building: this.getBuildingTasks(),
                maintenance: this.getMaintenanceTasks(),
                research: this.getResearchTasks()
            }
            console.info('[INFO] Tasks retrieved successfully:',
                Object.entries(tasks).map(([type, list]) => `${type}: ${list.length}`).join(', '))
            return tasks
        } catch (error) {
            console.error('[ERROR] Failed to get available tasks:', error)
            return {}
        }
    }

    prioritizeTasks(tasks) {
        console.info('[INFO] Starting task prioritization')
        try {
            const priorityMatrix = {
                mining: {
                    base: 10,
                    modifiers: {
                        resourceScarcity: 2,
                        distance: -0.1,
                        difficulty: -0.5
                    }
                },
                building: {
                    base: 8,
                    modifiers: {
                        urgency: 1.5,
                        complexity: -0.3
                    }
                },
                maintenance: {
                    base: 5,
                    modifiers: {
                        criticalLevel: 2,
                        efficiency: 1
                    }
                }
            }

            const prioritizedTasks = Object.entries(tasks)
                .map(([type, taskList]) => {
                    return taskList.map(task => ({
                        ...task,
                        priority: this.calculatePriority(task, type, priorityMatrix[type])
                    }))
                })
                .flat()
                .sort((a, b) => b.priority - a.priority)

            console.info(`[INFO] Tasks prioritized successfully. Top priority task: ${
                prioritizedTasks[0] ? `${prioritizedTasks[0].type} (${prioritizedTasks[0].priority})` : 'none'
            }`)
            return prioritizedTasks
        } catch (error) {
            console.error('[ERROR] Failed to prioritize tasks:', error)
            return []
        }
    }

    calculatePriority(task, type, priorityConfig) {
        try {
            let priority = priorityConfig.base

            for (const [modifier, value] of Object.entries(priorityConfig.modifiers)) {
                priority += this.getModifierValue(task, modifier) * value
            }

            priority *= this.getColonyNeedMultiplier(type)

            console.info(`[INFO] Calculated priority for ${type} task: ${priority}`)
            return priority
        } catch (error) {
            console.error(`[ERROR] Failed to calculate priority for ${type} task:`, error)
            return 0
        }
    }

    findBestTaskForColonist(colonist, tasks) {
        console.info(`[INFO] Finding best task for colonist ${colonist.id}`)
        try {
            const bestTask = tasks.find(task => {
                return this.isColonistSuitableForTask(colonist, task) &&
                    this.isTaskAvailable(task)
            })

            if (bestTask) {
                console.info(`[INFO] Found suitable task ${bestTask.type} for colonist ${colonist.id}`)
            } else {
                console.warn(`[WARN] No suitable task found for colonist ${colonist.id}`)
            }
            return bestTask
        } catch (error) {
            console.error(`[ERROR] Error finding task for colonist ${colonist.id}:`, error)
            return null
        }
    }

    assignColonistToTask(colonist, task) {
        try {
            console.info(`[INFO] Assigning colonist ${colonist.id} to ${task.type} task`)
            const path = this.calculatePath(colonist.position, task.position)

            colonist.assignTask({
                type: task.type,
                path: path,
                target: task.target,
                duration: task.estimatedDuration,
                onComplete: () => this.onTaskComplete(colonist, task)
            })

            this.updateWorkloadStats(task.type)
            console.info(`[INFO] Successfully assigned colonist ${colonist.id} to ${task.type} task`)
        } catch (error) {
            console.error(`[ERROR] Failed to assign colonist ${colonist.id} to task:`, error)
        }
    }

    onTaskComplete(colonist, task) {
        try {
            console.info(`[INFO] Task ${task.type} completed by colonist ${colonist.id}`)
            colonist.gainExperience(task.type, task.experienceGain)
            this.updateCompletionStats(task)
            this.checkForReassignment(colonist)
        } catch (error) {
            console.error(`[ERROR] Error processing task completion for colonist ${colonist.id}:`, error)
        }
    }

    updateWorkloadStats(taskType) {
        try {
            const current = this.workloadStats.get(taskType) || 0
            this.workloadStats.set(taskType, current + 1)
            console.info(`[INFO] Updated workload stats for ${taskType}. New count: ${current + 1}`)
        } catch (error) {
            console.error(`[ERROR] Failed to update workload stats for ${taskType}:`, error)
        }
    }

    calculateResourceNeed() {
        try {
            const currentResources = this.logic.resources.getCurrentLevels()
            const targetResources = this.logic.resources.getTargetLevels()

            const need = Object.entries(currentResources).reduce((need, [resource, current]) => {
                const target = targetResources[resource]
                return need + Math.max(0, (target - current) / target)
            }, 0)

            console.info(`[INFO] Calculated resource need: ${need}`)
            return need
        } catch (error) {
            console.error('[ERROR] Failed to calculate resource need:', error)
            return 0
        }
    }

    balanceWorkload() {
        console.info('[INFO] Starting workload balancing')
        try {
            const workloadDistribution = this.getWorkloadDistribution()
            const idealDistribution = this.calculateIdealDistribution()
            const actions = this.getBalancingActions(workloadDistribution, idealDistribution)

            console.info('[INFO] Workload balance calculation completed', {
                current: workloadDistribution,
                ideal: idealDistribution
            })
            return actions
        } catch (error) {
            console.error('[ERROR] Failed to balance workload:', error)
            return []
        }
    }
}

export default ColonistDistributor
