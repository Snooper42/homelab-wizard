import Foundation
import Testing
@testable import HomelabClient

/// The computer's clock words said as the phone says times (apple-loop.md,
/// item 1's first look: Settings showed "22-7" and "Daily at 04:00").
@Suite struct ClockWordsTests {
    let us = Locale(identifier: "en_US")
    let uk = Locale(identifier: "en_GB")

    @Test func quietHoursInTheWordsOfThePhone() {
        #expect(ClockWords.quietHours("22-7", locale: us) == "10 PM to 7 AM")
        #expect(ClockWords.quietHours(" 13-15 ", locale: us) == "1 PM to 3 PM")
        #expect(ClockWords.quietHours("0-6", locale: us) == "12 AM to 6 AM")
        #expect(ClockWords.quietHours("22-7", locale: uk) == "22:00 to 07:00")
    }

    @Test func quietHoursOffEmptyOrUnreadable() {
        #expect(ClockWords.quietHours("off", locale: us) == "Off")
        // Not set: the computer's own default, 22-7.
        #expect(ClockWords.quietHours("", locale: us) == "10 PM to 7 AM")
        // What the computer can't read either is shown as it is.
        #expect(ClockWords.quietHours("late", locale: us) == "late")
        #expect(ClockWords.quietHours("7-7", locale: us) == "7-7")
        #expect(ClockWords.quietHours("22-25", locale: us) == "22-25")
    }

    @Test func aScheduleInTheWordsOfThePhone() {
        #expect(ClockWords.schedule("daily at 04:00", locale: us) == "Every night at 4 AM")
        #expect(ClockWords.schedule("daily at 13:30", locale: us) == "Every day at 1:30 PM")
        #expect(ClockWords.schedule("daily at 22:15", locale: us) == "Every night at 10:15 PM")
        #expect(ClockWords.schedule("Sundays at 02:00", locale: us) == "Sundays at 2 AM")
        #expect(ClockWords.schedule("daily at 04:00", locale: uk) == "Every night at 04:00")
    }

    @Test func aScheduleItCantReadIsShownAsItIs() {
        #expect(ClockWords.schedule("", locale: us) == "")
        #expect(ClockWords.schedule("weekly", locale: us) == "Weekly")
        #expect(ClockWords.schedule("daily at 4", locale: us) == "Daily at 4")
    }
}
