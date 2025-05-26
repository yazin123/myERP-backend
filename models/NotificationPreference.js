const mongoose = require('mongoose');

const notificationPreferenceSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    // Email notifications
    email: {
        enabled: {
            type: Boolean,
            default: true
        },
        digest: {
            enabled: {
                type: Boolean,
                default: true
            },
            frequency: {
                type: String,
                enum: ['immediate', 'daily', 'weekly'],
                default: 'daily'
            },
            time: {
                type: String,
                default: '09:00' // Time for daily/weekly digests
            }
        },
        types: {
            taskAssigned: {
                type: Boolean,
                default: true
            },
            taskUpdated: {
                type: Boolean,
                default: true
            },
            taskCompleted: {
                type: Boolean,
                default: true
            },
            projectUpdate: {
                type: Boolean,
                default: true
            },
            comments: {
                type: Boolean,
                default: true
            },
            mentions: {
                type: Boolean,
                default: true
            },
            deadlineApproaching: {
                type: Boolean,
                default: true
            },
            teamChanges: {
                type: Boolean,
                default: true
            }
        }
    },
    // In-app notifications
    inApp: {
        enabled: {
            type: Boolean,
            default: true
        },
        desktop: {
            type: Boolean,
            default: true
        },
        sound: {
            type: Boolean,
            default: true
        },
        types: {
            taskAssigned: {
                type: Boolean,
                default: true
            },
            taskUpdated: {
                type: Boolean,
                default: true
            },
            taskCompleted: {
                type: Boolean,
                default: true
            },
            projectUpdate: {
                type: Boolean,
                default: true
            },
            comments: {
                type: Boolean,
                default: true
            },
            mentions: {
                type: Boolean,
                default: true
            },
            deadlineApproaching: {
                type: Boolean,
                default: true
            },
            teamChanges: {
                type: Boolean,
                default: true
            }
        }
    },
    // Slack integration
    slack: {
        enabled: {
            type: Boolean,
            default: false
        },
        webhookUrl: String,
        channel: String,
        types: {
            taskAssigned: {
                type: Boolean,
                default: false
            },
            taskUpdated: {
                type: Boolean,
                default: false
            },
            taskCompleted: {
                type: Boolean,
                default: false
            },
            projectUpdate: {
                type: Boolean,
                default: false
            },
            comments: {
                type: Boolean,
                default: false
            },
            mentions: {
                type: Boolean,
                default: false
            },
            deadlineApproaching: {
                type: Boolean,
                default: false
            },
            teamChanges: {
                type: Boolean,
                default: false
            }
        }
    },
    // Importance thresholds
    minimumImportance: {
        email: {
            type: String,
            enum: ['low', 'medium', 'high', 'urgent'],
            default: 'low'
        },
        inApp: {
            type: String,
            enum: ['low', 'medium', 'high', 'urgent'],
            default: 'low'
        },
        slack: {
            type: String,
            enum: ['low', 'medium', 'high', 'urgent'],
            default: 'medium'
        }
    },
    // Do not disturb settings
    doNotDisturb: {
        enabled: {
            type: Boolean,
            default: false
        },
        startTime: {
            type: String,
            default: '22:00'
        },
        endTime: {
            type: String,
            default: '08:00'
        },
        timezone: {
            type: String,
            default: 'UTC'
        }
    }
}, {
    timestamps: true
});

// Ensure unique user preferences
notificationPreferenceSchema.index({ user: 1 }, { unique: true });

// Methods
notificationPreferenceSchema.methods.shouldNotify = function(type, channel, importance) {
    // Check if notifications are enabled for this channel
    if (!this[channel].enabled) return false;

    // Check if this type is enabled for this channel
    if (!this[channel].types[type]) return false;

    // Check importance threshold
    const importanceLevels = ['low', 'medium', 'high', 'urgent'];
    const thresholdIndex = importanceLevels.indexOf(this.minimumImportance[channel]);
    const importanceIndex = importanceLevels.indexOf(importance);
    
    if (importanceIndex < thresholdIndex) return false;

    // Check do not disturb
    if (this.doNotDisturb.enabled) {
        const now = new Date();
        const userTz = this.doNotDisturb.timezone;
        const userTime = now.toLocaleTimeString('en-US', { timeZone: userTz, hour12: false });
        
        const start = this.doNotDisturb.startTime;
        const end = this.doNotDisturb.endTime;
        
        if (start <= end) {
            if (userTime >= start && userTime <= end) return false;
        } else {
            // Handle case where DND period crosses midnight
            if (userTime >= start || userTime <= end) return false;
        }
    }

    return true;
};

// Static methods
notificationPreferenceSchema.statics.getDefaultPreferences = function() {
    return {
        email: {
            enabled: true,
            digest: {
                enabled: true,
                frequency: 'daily',
                time: '09:00'
            },
            types: {
                taskAssigned: true,
                taskUpdated: true,
                taskCompleted: true,
                projectUpdate: true,
                comments: true,
                mentions: true,
                deadlineApproaching: true,
                teamChanges: true
            }
        },
        inApp: {
            enabled: true,
            desktop: true,
            sound: true,
            types: {
                taskAssigned: true,
                taskUpdated: true,
                taskCompleted: true,
                projectUpdate: true,
                comments: true,
                mentions: true,
                deadlineApproaching: true,
                teamChanges: true
            }
        },
        slack: {
            enabled: false,
            types: {
                taskAssigned: false,
                taskUpdated: false,
                taskCompleted: false,
                projectUpdate: false,
                comments: false,
                mentions: false,
                deadlineApproaching: false,
                teamChanges: false
            }
        }
    };
};

const NotificationPreference = mongoose.model('NotificationPreference', notificationPreferenceSchema);

module.exports = NotificationPreference; 