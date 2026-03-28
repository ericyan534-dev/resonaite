//
//  ViewController.m
//  Algo SDK Sample
//
//  Created by Donald on 6/7/15.
//  Copyright (c) 2015 NeuroSky. All rights reserved.
//

#import "ViewController.h"

#include "FFTAccelerate.h"

#include <sys/time.h>

#include "canned_data.c"

#define X_RANGE             256
#define X_FREQ_RANGE        100
#define INPUT_SIZE          (512*2)

//#define USE_CANNED_DATA

typedef NS_ENUM(NSInteger, SegmentIndexType) {
    SegmentAppreciation = 0,
    SegmentMentalEffort,
    SegmentMentalEffort2,
    SegmentFamiliarity,
    SegmentFamiliarity2,
    SegmentCreativity,
    SegmentAlertness,
    SegmentCognitivePreparedness,
    SegmentEEGBandpower,
    SegmentEEGRaw,
    SegmentFreq,
    SegmentMax
};

typedef struct _ALGO_SETTING {
    NSMutableArray *index[5];
    int interval;
    
    int minInterval;
    int maxInterval;
    
    // for BCQ
    int bcqThreshold;
    int bcqValid;
    int bcqWindow;
} ALGO_SETTING;

typedef struct _PLOTs {
    CPTPlot *plot[5];
} PLOTs;

typedef struct _COLORS {
    CPTColor *color[5];
} COLORS;

typedef struct _ALGO_CONTEXT {
    
    BOOL plotAvailable;
    
    NSString *graphTitle;
    NSString *plotName[5];
    
    PLOTs plots;
    
    COLORS colors;
    
    float xRange;
    
    float plotMinY;
    float plotMaxY;
    
    ALGO_SETTING setting;
} ALGO_CONTEXT;

const ALGO_SETTING defaultAlgoSetting[SegmentMax] = {
/*   index     interval    minInterval maxInterval bcqThreshold                bcqValid    bcqWindow*/
    {{nil},    1,          1,          5,          0,                          0,          0},
    {{nil},    1,          1,          5,          0,                          0,          0},
    {{nil},    30,         30,         300,        0,                          0,          0},
    {{nil},    1,          1,          5,          0,                          0,          0},
    {{nil},    30,         30,         300,        0,                          0,          0},
    {{nil},    1,          1,          5,          0,                          0,          30},
    {{nil},    1,          1,          5,          0,                          0,          30},
    {{nil},    1,          1,          5,          0,                          0,          30},
    {{nil},    1,          1,          1,          0,                          0,          0},
    {{nil},    0,          0,          0,          0,                          0,          0},
    {{nil},    0,          0,          0,          0,                          0,          0}
};

ALGO_CONTEXT algoList[SegmentMax] = {
/*    plotAvaliable graphTitle                  plotName                                                        plots   colors  xRange          plotMinY    plotMaxY    setting*/
    { YES,          @"Appreciation",            {@"AP Index",    nil},                                          {nil},  {nil},  X_RANGE,        0.0f,       5.0f,       defaultAlgoSetting[SegmentAppreciation] },
    { YES,          @"Mental Effort",           {@"Abs ME",      @"Diff ME"},                                   {nil},  {nil},  X_RANGE,        -110,       200,        defaultAlgoSetting[SegmentMentalEffort] },
    { NO,           nil,                        {nil,            nil},                                          {nil},  {nil},  X_RANGE,        0,          0,          defaultAlgoSetting[SegmentMentalEffort2] },
    { YES,          @"Familiarity",             {@"Abs F",       @"Diff F"},                                    {nil},  {nil},  X_RANGE,        -110,       200,        defaultAlgoSetting[SegmentFamiliarity] },
    { NO,           nil,                        {nil,            nil},                                          {nil},  {nil},  X_RANGE,        0,          0,          defaultAlgoSetting[SegmentFamiliarity2] },
    { YES,          @"Creativity",              {@"CR Value",    nil},                                          {nil},  {nil},  X_RANGE,        -1,         2,          defaultAlgoSetting[SegmentCreativity] },
    { YES,          @"Alertness",               {@"AL Value",    nil},                                          {nil},  {nil},  X_RANGE,        -1,         2,          defaultAlgoSetting[SegmentAlertness] },
    { YES,          @"Cognitive Preparedness",  {@"CP Value",    nil},                                          {nil},  {nil},  X_RANGE,        -1,         2,          defaultAlgoSetting[SegmentCognitivePreparedness] },
    { YES,          @"EEG Bandpower",           {@"Delta",  @"Theta",    @"Alpha",    @"Beta",    @"Gamma"},    {nil},  {nil},  X_RANGE,        -20,        40,         defaultAlgoSetting[SegmentEEGBandpower] },
    { YES,          @"EEG Raw",                 {@"EEG Raw",     nil},                                          {nil},  {nil},  X_RANGE,        -600,       1200,       defaultAlgoSetting[SegmentEEGRaw] },
    { YES,          @"Frequency (Hz)",          {@"Freq",        nil},                                          {nil},  {nil},  X_FREQ_RANGE,   0,          100,        defaultAlgoSetting[SegmentFreq] }
};


@implementation ViewController {
    @private
    
    NSTimer *myTimer;
    
    BOOL bRunning;
    BOOL bPaused;
    
    CPTXYGraph *graph;
    
    int algoTypes;
    NSTimer *graphTimer;
}

- (void) removeAlgoPlot {
    for (int i=0;i<SegmentMax;i++) {
        if (algoList[i].plotAvailable) {
            for (int j=0;j<sizeof(algoList[i].plots.plot)/sizeof(algoList[i].plots.plot[0]);j++) {
                if (algoList[i].plots.plot[j] != nil) {
                    [graph removePlot:algoList[i].plots.plot[j]];
                    algoList[i].plots.plot[j] = nil;
                }
            }
        }
    }
}

- (void) resetAlgoPlotData {
    for (int i=0;i<SegmentMax;i++) {
        for (int j=0;j<sizeof(algoList[i].setting.index)/sizeof(algoList[i].setting.index[0]);j++) {
            if (algoList[i].setting.index[j] != nil) {
                [algoList[i].setting.index[j] removeAllObjects];
            }
        }
    }
}

- (void) resetAlgoSettings {
    [self resetAlgoPlotData];
    
    for (int i=0;i<SegmentMax;i++) {
        NSMutableArray *backupIndex[5] = {nil};
        for (int j=0;j<sizeof(algoList[i].setting.index)/sizeof(algoList[i].setting.index[0]);j++) {
            backupIndex[j] = algoList[i].setting.index[j];
        }
        algoList[i].setting = defaultAlgoSetting[i];
        for (int j=0;j<sizeof(algoList[i].setting.index)/sizeof(algoList[i].setting.index[0]);j++) {
            algoList[i].setting.index[j] = backupIndex[j];
        }
    }
}

NSMutableString *stateStr;
NSMutableString *signalStr;
NSMutableString *attMedStr;

- (void)viewDidLoad {
    [super viewDidLoad];
    
    for (int i=0;i<SegmentMax;i++) {
        algoList[i].setting.index[0] = [[NSMutableArray alloc] init];
        if (algoList[i].plotAvailable) {
            algoList[i].colors.color[0] = [CPTColor blueColor];
            
            if (i == SegmentMentalEffort || i == SegmentFamiliarity) {
                // ME and F have two plots
                algoList[i].setting.index[1] = [[NSMutableArray alloc] init];
                algoList[i].colors.color[1] = [CPTColor redColor];
            }else if (i == SegmentEEGBandpower) {
                // BP has 5 plots
                algoList[i].setting.index[1] = [[NSMutableArray alloc] init];
                algoList[i].colors.color[1] = [CPTColor redColor];
                
                algoList[i].setting.index[2] = [[NSMutableArray alloc] init];
                algoList[i].colors.color[2] = [CPTColor greenColor];
                
                algoList[i].setting.index[3] = [[NSMutableArray alloc] init];
                algoList[i].colors.color[3] = [CPTColor purpleColor];
                
                algoList[i].setting.index[4] = [[NSMutableArray alloc] init];
                algoList[i].colors.color[4] = [CPTColor yellowColor];
            }
        }
    }
    [[TGStreamForMac sharedInstance] setDelegate:self];
    
#ifdef USE_CANNED_DATA
    [connectButton setEnabled:NO];
//    [apCheckbox setEnabled:YES];
//    [meCheckbox setEnabled:YES];
//    [me2Checkbox setEnabled:YES];
//    [fCheckbox setEnabled:YES];
//    [f2Checkbox setEnabled:YES];
    [attCheckbox setEnabled:YES];
    [medCheckbox setEnabled:YES];
//    [crCheckbox setEnabled:YES];
//    [alCheckbox setEnabled:YES];
//    [cpCheckbox setEnabled:YES];
    [bpCheckbox setEnabled:YES];
    [eyeBlinkCheckbox setEnabled:YES];
    [setAlgoButton setEnabled:YES];
    [startPauseButton setEnabled:NO];
    [stopButton setEnabled:NO];
    
//    [intervalValue setStringValue:@"1"];
//    [intervalSlider setIntValue:1];
//    [intervalButton setEnabled:NO];
//    [intervalSlider setEnabled:NO];
    
    [cannedBulkButton setHidden:NO];
    [cannedBulkButton setEnabled:YES];
#else
    [cannedBulkButton setHidden:YES];
#endif
    
    for (int i=0;i<20;i++) {
        [bcqWindowCombo addItemWithObjectValue:[NSString stringWithFormat:@"%d", i*5 + 30]];
    }
    
    if (graphTimer == nil) {
        graphTimer = [NSTimer scheduledTimerWithTimeInterval:0.1f target:self selector:@selector(reloadGraph) userInfo:nil repeats:YES];
    }
}

- (CPTXYGraph*)setupGraph: (CPTGraphHostingView*)hostView yMin:(float)yMin length:(float)length range:(int)range graphTitle:(NSString*)graphTitle {
    // Create graph from theme
    CPTXYGraph *newGraph = [[CPTXYGraph alloc] initWithFrame:CGRectZero];
    CPTTheme *theme      = [CPTTheme themeNamed:kCPTPlainWhiteTheme];
    [newGraph applyTheme:theme];
    
    hostView.hostedGraph = newGraph;
    
    // Setup scatter plot space
    CPTXYPlotSpace *plotSpace = (CPTXYPlotSpace *)newGraph.defaultPlotSpace;
    NSTimeInterval xLow       = 0.0;
    plotSpace.xRange = [CPTPlotRange plotRangeWithLocation:CPTDecimalFromDouble(xLow) length:CPTDecimalFromDouble(range)];
    plotSpace.yRange = [CPTPlotRange plotRangeWithLocation:CPTDecimalFromDouble(yMin) length:CPTDecimalFromDouble(length)];
    
    // Axes
    CPTXYAxisSet *axisSet = (CPTXYAxisSet *)newGraph.axisSet;
    CPTXYAxis *x          = axisSet.xAxis;
    x.orthogonalCoordinateDecimal = CPTDecimalFromDouble(1.0);
    x.majorIntervalLength         = CPTDecimalFromDouble(0);
    x.minorTicksPerInterval       = 0;
    
    CPTXYAxis *y = axisSet.yAxis;
    
    if (length < 10) {
        y.majorIntervalLength         = CPTDecimalFromDouble(1);
        y.minorTicksPerInterval       = 1;
        y.orthogonalCoordinateDecimal = CPTDecimalFromDouble(100);
        
        x.orthogonalCoordinateDecimal = CPTDecimalFromDouble(50.0);
        x.majorIntervalLength         = CPTDecimalFromDouble(10);
        x.minorTicksPerInterval       = 10;
    } else if (length < 100) {
        y.majorIntervalLength         = CPTDecimalFromDouble(100);
        y.minorTicksPerInterval       = 1;
        y.orthogonalCoordinateDecimal = CPTDecimalFromDouble(100);
        
        x.orthogonalCoordinateDecimal = CPTDecimalFromDouble(10);
        x.majorIntervalLength         = CPTDecimalFromDouble(200);
        x.minorTicksPerInterval       = 1;
    } else if (length < 500) {
        y.majorIntervalLength         = CPTDecimalFromDouble(100);
        y.minorTicksPerInterval       = 1;
        y.orthogonalCoordinateDecimal = CPTDecimalFromDouble(100);
        
        x.orthogonalCoordinateDecimal = CPTDecimalFromDouble(0);
        x.majorIntervalLength         = CPTDecimalFromDouble(200);
        x.minorTicksPerInterval       = 1;
    } else if (length > 500) {
        y.majorIntervalLength         = CPTDecimalFromDouble(200);
        y.minorTicksPerInterval       = 2;
        y.orthogonalCoordinateDecimal = CPTDecimalFromDouble(range/3);
        
        x.orthogonalCoordinateDecimal = CPTDecimalFromDouble(0);
        x.majorIntervalLength         = CPTDecimalFromDouble(10);
        x.minorTicksPerInterval       = 0;
    }
    CPTMutableLineStyle *gridLineStyle = [CPTMutableLineStyle lineStyle];
    gridLineStyle.lineWidth              = 1.0;
    gridLineStyle.lineColor              = [CPTColor grayColor];
    y.majorGridLineStyle = gridLineStyle;
    
    x.majorGridLineStyle = gridLineStyle;
    
    newGraph.title = graphTitle;
    
    return newGraph;
}

- (CPTPlot*) addPlotToGraph: (CPTXYGraph*)gp color:(CPTColor*)color plotTitle:(NSString*)plotTitle {
    // Create a plot that uses the data source method
    CPTScatterPlot *dataSourceLinePlot = [[CPTScatterPlot alloc] init];
    
    CPTMutableLineStyle *lineStyle = [dataSourceLinePlot.dataLineStyle mutableCopy];
    lineStyle.lineWidth              = 1.5;
    lineStyle.lineColor              = color;
    dataSourceLinePlot.dataLineStyle = lineStyle;
    dataSourceLinePlot.interpolation = CPTScatterPlotInterpolationLinear;
    
    dataSourceLinePlot.dataSource = self;
    
    dataSourceLinePlot.showLabels = YES;
    
    dataSourceLinePlot.title = plotTitle;
    
    [gp addPlot:dataSourceLinePlot];
    
    // Add legend
    gp.legend                 = [CPTLegend legendWithGraph:gp];
    gp.legend.fill            = [CPTFill fillWithColor:[CPTColor greenColor]];
    gp.legend.borderLineStyle = ((CPTXYAxisSet *)gp.axisSet).xAxis.axisLineStyle;
    gp.legend.cornerRadius    = 2.0;
    gp.legend.numberOfRows    = 1;
    gp.legend.numberOfColumns = 5;
    gp.legend.delegate        = self;
    gp.legendAnchor           = CPTRectAnchorBottom;
    gp.legendDisplacement     = CGPointMake( 0.0, 5.0f * CPTFloat(1.25) );
    
    return dataSourceLinePlot;
}

- (void)setRepresentedObject:(id)representedObject {
    [super setRepresentedObject:representedObject];

    // Update the view, if already loaded.
}

#pragma mark
#pragma NSK EEG SDK Delegate
- (void)stateChanged:(NskAlgoState)state reason:(NskAlgoReason)reason {
    if (stateStr == nil) {
        stateStr = [[NSMutableString alloc] init];
    }
    [stateStr setString:@""];
    [stateStr appendString:@"SDK State: "];
    switch (state) {
        case NskAlgoStateAnalysingBulkData:
        {
            bRunning = TRUE;
            bPaused = FALSE;
            [stateStr appendString:@"Analysing bulk data"];
            dispatch_async(dispatch_get_main_queue(), ^{
                ((NSButton*)startPauseButton).title = @"Pause";
                [startPauseButton setEnabled:NO];
                [stopButton setEnabled:YES];
            });
        }
            break;
        case NskAlgoStateCollectingBaselineData:
        {
            bRunning = TRUE;
            bPaused = FALSE;
            [stateStr appendString:@"Collecting baseline"];
            dispatch_async(dispatch_get_main_queue(), ^{
                ((NSButton*)startPauseButton).title = @"Pause";
                [startPauseButton setEnabled:YES];
                [stopButton setEnabled:YES];
#ifdef USE_CANNED_DATA
                [cannedBulkButton setEnabled:YES];
#endif
            });
        }
            break;
        case NskAlgoStateInited:
        {
            bRunning = FALSE;
            bPaused = TRUE;
            [stateStr appendString:@"Inited"];
            dispatch_async(dispatch_get_main_queue(), ^{
                ((NSButton*)startPauseButton).title = @"Start";
                [startPauseButton setEnabled:YES];
                [stopButton setEnabled:NO];
                [attLevelIndicator setIntValue:0];
                [attValue setStringValue:@""];
                
                [medLevelIndicator setIntValue:0];
                [medValue setStringValue:@""];
                
//                [intervalSlider setEnabled:YES];
//                [intervalButton setEnabled:YES];
//                [intervalValue setEnabled:YES];
            });
        }
            break;
        case NskAlgoStatePause:
        {
            bPaused = TRUE;
            [stateStr appendString:@"Pause"];
            dispatch_async(dispatch_get_main_queue(), ^{
                ((NSButton*)startPauseButton).title = @"Start";
                [startPauseButton setEnabled:YES];
                [stopButton setEnabled:YES];
            });
        }
            break;
        case NskAlgoStateRunning:
        {
            [stateStr appendString:@"Running"];
            bRunning = TRUE;
            bPaused = FALSE;
            dispatch_async(dispatch_get_main_queue(), ^{
                ((NSButton*)startPauseButton).title = @"Pause";
                [startPauseButton setEnabled:YES];
                [stopButton setEnabled:YES];
#ifdef USE_CANNED_DATA
                [cannedBulkButton setEnabled:YES];
#endif
            });
        }
            break;
        case NskAlgoStateStop:
        {
            [stateStr appendString:@"Stop"];
            bRunning = FALSE;
            bPaused = TRUE;
            dispatch_async(dispatch_get_main_queue(), ^{
                ((NSButton*)startPauseButton).title = @"Start";
                [startPauseButton setEnabled:YES];
                [stopButton setEnabled:NO];
                [attLevelIndicator setIntValue:0];
                [attValue setStringValue:@""];
                
                [medLevelIndicator setIntValue:0];
                [medValue setStringValue:@""];
                
//                [bcqThresholdTitle setEnabled:YES];
//                [bcqThresholdSegment setEnabled:YES];
//                [bcqWindowTitle setEnabled:YES];
//                [bcqWindowCombo setEnabled:YES];
                
#ifdef USE_CANNED_DATA
                [cannedBulkButton setEnabled:YES];
#endif
            });
        }
            break;
        case NskAlgoStateUninited:
            [stateStr appendString:@"Uninit"];
            break;
    }
    switch (reason) {
        case NskAlgoReasonBaselineExpired:
            [stateStr appendString:@" | Baseline expired"];
            break;
        case NskAlgoReasonConfigChanged:
            [stateStr appendString:@" | Config changed"];
            break;
        case NskAlgoReasonNoBaseline:
            [stateStr appendString:@" | No Baseline"];
            break;
        case NskAlgoReasonSignalQuality:
            [stateStr appendString:@" | Signal quality"];
            break;
        case NskAlgoReasonUserProfileChanged:
            [stateStr appendString:@" | User profile changed"];
            break;
        case NskAlgoReasonUserTrigger:
            [stateStr appendString:@" | By user"];
            break;
    }
    printf([stateStr UTF8String]);
    printf("\n");
    dispatch_async(dispatch_get_main_queue(), ^{
        //code you want on the main thread.
        NSTextField *text = (NSTextField*) stateLabel;
        [text setStringValue:stateStr];
    });
}

- (void) addValue: (NSNumber*)value array:(NSMutableArray*)array {
    @synchronized(graph) {
        if ([array count] >= X_RANGE) {
            [array removeObjectAtIndex:0];
        }
        [array addObject:
         @{ @(CPTScatterPlotFieldX): @([array count]),
            @(CPTScatterPlotFieldY): @([value floatValue]) }
         ];
        
        for (int j=0;j<SegmentMax;j++) {
            if (algoList[j].plotAvailable == YES) {
                NSMutableArray *index = nil;
                for (int i=0;i<sizeof(algoList[j].setting.index)/sizeof(algoList[j].setting.index[0]);i++) {
                    if (algoList[j].setting.index[i] == array) {
                        index = algoList[j].setting.index[i];
                        break;
                    }
                }
                for (int i=0;i<[index count];i++) {
                    NSDictionary *dict = @{ @(CPTScatterPlotFieldX): @(i), @(CPTScatterPlotFieldY): index[i][@(CPTScatterPlotFieldY)] };
                    [index replaceObjectAtIndex:i withObject:dict];
                }
            }
        }
    }
}

- (void)signalQuality:(NskAlgoSignalQuality)signalQuality {
    if (signalStr == nil) {
        signalStr = [[NSMutableString alloc] init];
    }
    [signalStr setString:@""];
    [signalStr appendString:@"Signal quailty: "];
    switch (signalQuality) {
        case NskAlgoSignalQualityGood:
            [signalStr appendString:@"Good"];
            break;
        case NskAlgoSignalQualityMedium:
            [signalStr appendString:@"Medium"];
            break;
        case NskAlgoSignalQualityNotDetected:
            [signalStr appendString:@"Not detected"];
            break;
        case NskAlgoSignalQualityPoor:
            [signalStr appendString:@"Poor"];
            break;
    }
    dispatch_async(dispatch_get_main_queue(), ^{
        //code you want on the main thread.
        NSTextField *text = (NSTextField*) signalLabel;
        [text setStringValue:signalStr];
    });
}

int bp_index = 0;

float lMeditation = 0;
float lAttention = 0;

- (void)bpAlgoIndex:(NSNumber *)delta theta:(NSNumber *)theta alpha:(NSNumber *)alpha beta:(NSNumber *)beta gamma:(NSNumber *)gamma {
    NSLog(@"bp[%d] = (delta)%1.6f (theta)%1.6f (alpha)%1.6f (beta)%1.6f (gamma)%1.6f", bp_index, [delta floatValue], [theta floatValue], [alpha floatValue], [beta floatValue], [gamma floatValue]);
    bp_index++;
    [self addValue:delta array:algoList[SegmentEEGBandpower].setting.index[0]];
    [self addValue:theta array:algoList[SegmentEEGBandpower].setting.index[1]];
    [self addValue:alpha array:algoList[SegmentEEGBandpower].setting.index[2]];
    [self addValue:beta array:algoList[SegmentEEGBandpower].setting.index[3]];
    [self addValue:gamma array:algoList[SegmentEEGBandpower].setting.index[4]];
}

- (void)medAlgoIndex:(NSNumber *)med_index {
    NSLog(@"Meditation: %3.0f", [med_index floatValue]);
    lMeditation = [med_index floatValue];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [medLevelIndicator setIntValue:lMeditation];
        [medValue setStringValue:[NSString stringWithFormat:@"%3.0f", lMeditation]];
    });
}

- (void)attAlgoIndex:(NSNumber *)att_index {
    NSLog(@"Attention: %3.0f", [att_index floatValue]);
    lAttention = [att_index floatValue];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [attLevelIndicator setIntValue:lAttention];
        [attValue setStringValue:[NSString stringWithFormat:@"%3.0f", lAttention]];
    });
}

BOOL bBlink = NO;
- (void)eyeBlinkDetect:(NSNumber *)strength {
    NSLog(@"Eye blink detected: %d", [strength intValue]);
    dispatch_async(dispatch_get_main_queue(), ^{
        [eyeBlinkImage setImage:[NSImage imageNamed:@"led-on"]];
        bBlink = YES;
        [NSTimer scheduledTimerWithTimeInterval:0.25f target:self selector:@selector(eyeBlinkAnimate) userInfo:nil repeats:NO];
    });
}

- (void)eyeBlinkAnimate {
    if (bBlink) {
        [eyeBlinkImage setImage:[NSImage imageNamed:@"led-off"]];
        bBlink = NO;
    }
}

- (IBAction)openConnectionAction:(id)sender {
    [[TGStreamForMac sharedInstance] startStream];
    
    [self headsetConnection:YES];
}

- (IBAction)setAlgos:(id)sender {
    algoTypes = 0;
    [self resetAlgoPlotData];
    [self resetAlgoSettings];
    
    for (int i=0;i<SegmentEEGRaw;i++) {
        [segmentControl setEnabled:NO forSegment:i];
        [segmentControl setSelected:NO forSegment:i];
    }
    
    ((CPTGraphHostingView*)graphHostView).hostedGraph = nil;
    [[textFieldView documentView] setString:@""];
    [textFieldView setHidden:YES];
    
    [stateLabel setStringValue:@""];
    [signalLabel setStringValue:@""];
    
//    [intervalSlider setEnabled:NO];
//    [intervalButton setEnabled:NO];
//    [intervalSlider setIntValue:1];
//    [intervalValue setStringValue:@"1"];
    
//    [bcqThresholdTitle setHidden:YES];
//    [bcqThresholdSegment setHidden:YES];
//    [bcqWindowCombo setHidden:YES];
//    [bcqWindowTitle setHidden:YES];
    
    if ([bpCheckbox state]) {
        algoTypes |= NskAlgoEegTypeBP;
        [segmentControl setEnabled:YES forSegment:SegmentEEGBandpower];
    }
    
    if ([attCheckbox state]) {
        algoTypes |= NskAlgoEegTypeAtt;
    }
    if ([medCheckbox state]) {
        algoTypes |= NskAlgoEegTypeMed;
    }
    if ([eyeBlinkCheckbox state]) {
        algoTypes |= NskAlgoEegTypeBlink;
    }
    
    if (algoTypes == 0) {
        NSAlert *alert = [[NSAlert alloc] init];
        [alert setMessageText:@"Please select at least ONE algorithm"];
        [alert addButtonWithTitle:@"OK"];
        [alert runModal];
    } else {
        NskAlgoSdk *handle = [NskAlgoSdk sharedInstance];
        NSInteger ret;
        handle.delegate = self;
        ret = [[NskAlgoSdk sharedInstance] setAlgorithmTypes:(NskAlgoEegType)algoTypes];
        if (ret != 0) {
            NSAlert *alert = [[NSAlert alloc] init];
            [alert setMessageText:[NSString stringWithFormat:@"Failed to init the EEG Algo SDK [%ld]", (long)ret]];
            [alert addButtonWithTitle:@"OK"];
            [alert runModal];
            return;
        }
        NSString *verStr = [[NskAlgoSdk sharedInstance] getSdkVersion];
        NSMutableString *version = [NSMutableString stringWithFormat:@"SDK Ver.: %@", verStr];
        const char * temp2 = [verStr UTF8String];
        if (temp2[6] == 0x12) {
            NSAlert *alert = [[NSAlert alloc] init];
            [alert setMessageText:@"Cracked version"];
            [alert addButtonWithTitle:@"OK"];
            [alert runModal];
        }
        if (algoTypes & NskAlgoEegTypeBlink) {
            [version appendFormat:@"\nEye Blink Detection Ver.: %@", [[NskAlgoSdk sharedInstance] getAlgoVersion:NskAlgoEegTypeBlink]];
        }
        if (algoTypes & NskAlgoEegTypeAtt) {
            [version appendFormat:@"\nAttention Ver.: %@", [[NskAlgoSdk sharedInstance] getAlgoVersion:NskAlgoEegTypeAtt]];
        }
        if (algoTypes & NskAlgoEegTypeMed) {
            [version appendFormat:@"\nMeditation Ver.: %@", [[NskAlgoSdk sharedInstance] getAlgoVersion:NskAlgoEegTypeMed]];
        }
        if (algoTypes & NskAlgoEegTypeBP) {
            [version appendFormat:@"\nEEG Bandpower Ver.: %@", [[NskAlgoSdk sharedInstance] getAlgoVersion:NskAlgoEegTypeBP]];
        }
        NSAlert *alert = [[NSAlert alloc] init];
        [alert setMessageText:version];
        [alert addButtonWithTitle:@"OK"];
        [alert runModal];
    }
}

- (void)reloadGraph {
    @synchronized(graph) {
        if (graph) {
            CPTColor *fillColor = [CPTColor colorWithComponentRed:1 green:1 blue:1 alpha:1.0];
            switch ([segmentControl selectedSegment]) {
                case SegmentCreativity: {
                    if (algoList[SegmentCreativity].setting.bcqValid == 1) {
                        fillColor = [CPTColor colorWithComponentRed:0 green:0.7f blue:0 alpha:1.0];
                    } else if (algoList[SegmentCreativity].setting.bcqValid == -1) {
                        fillColor = [CPTColor colorWithComponentRed:0.7f green:0 blue:0 alpha:1.0];
                    }
                    break;
                }
                case SegmentAlertness: {
                    if (algoList[SegmentAlertness].setting.bcqValid == 1) {
                        fillColor = [CPTColor colorWithComponentRed:0 green:0.7f blue:0 alpha:1.0];
                    } else if (algoList[SegmentAlertness].setting.bcqValid == -1) {
                        fillColor = [CPTColor colorWithComponentRed:0.7f green:0 blue:0 alpha:1.0];
                    }
                    break;
                }
                case SegmentCognitivePreparedness: {
                    if (algoList[SegmentCognitivePreparedness].setting.bcqValid == 1) {
                        fillColor = [CPTColor colorWithComponentRed:0 green:0.7f blue:0 alpha:1.0];
                    } else if (algoList[SegmentCognitivePreparedness].setting.bcqValid == -1) {
                        fillColor = [CPTColor colorWithComponentRed:0.7f green:0 blue:0 alpha:1.0];
                    }
                    break;
                }
            }
            graph.plotAreaFrame.plotArea.fill = [CPTFill fillWithColor:fillColor];
            [graph reloadData];
        }
    }
}

- (IBAction)startPause:(id)sender {
    if (bPaused) {
//        [bcqThresholdTitle setEnabled:NO];
//        [bcqThresholdSegment setEnabled:NO];
//        [bcqWindowTitle setEnabled:NO];
//        [bcqWindowCombo setEnabled:NO];
        
//        algoList[SegmentCreativity].setting.bcqValid = algoList[SegmentAlertness].setting.bcqValid = algoList[SegmentCognitivePreparedness].setting.bcqValid = 0;
        
        [[NskAlgoSdk sharedInstance] startProcess];
    } else {
        [[NskAlgoSdk sharedInstance] pauseProcess];
    }
}

- (IBAction)stop:(id)sender {
    [[NskAlgoSdk sharedInstance] stopProcess];
}

- (IBAction)segmentChanged:(id)sender {
    NSSegmentedControl *control = (NSSegmentedControl*)segmentControl;
    [self removeAlgoPlot];
    
//    [intervalButton setEnabled:YES];
    
    // always hidden BCQ related UI components
//    [bcqThresholdTitle setHidden:YES];
//    [bcqThresholdSegment setHidden:YES];
//    [bcqWindowTitle setHidden:YES];
//    [bcqWindowCombo setHidden:YES];
    
    if (algoList[control.selectedSegment].plotAvailable) {
        [graphHostView setHidden:NO];
        [textFieldView setHidden:YES];
        
        graph = [self setupGraph:graphHostView yMin:algoList[control.selectedSegment].plotMinY length:algoList[control.selectedSegment].plotMaxY range:algoList[control.selectedSegment].xRange graphTitle:algoList[control.selectedSegment].graphTitle];
        
        for (int i=0;i<sizeof(algoList[control.selectedSegment].plots.plot)/sizeof(algoList[control.selectedSegment].plots.plot[0]);i++) {
            if (algoList[control.selectedSegment].plotName[i] != nil) {
                algoList[control.selectedSegment].plots.plot[i] = [self addPlotToGraph:graph color:algoList[control.selectedSegment].colors.color[i] plotTitle:algoList[control.selectedSegment].plotName[i]];
            }
        }
        
//        [intervalButton setEnabled:YES];
//        [intervalSlider setEnabled:YES];
//        [intervalSlider setMinValue:algoList[control.selectedSegment].setting.minInterval];
//        [intervalSlider setMaxValue:algoList[control.selectedSegment].setting.maxInterval];
//        [intervalSlider setIntValue:algoList[control.selectedSegment].setting.interval];
//        [intervalValue setStringValue:[NSString stringWithFormat:@"%d", algoList[control.selectedSegment].setting.interval]];
    } else {
        [graphHostView setHidden:YES];
        [textFieldView setHidden:NO];
        
//        [intervalButton setEnabled:YES];
//        [intervalSlider setEnabled:YES];
//        [intervalSlider setMinValue:algoList[control.selectedSegment].setting.minInterval];
//        [intervalSlider setMaxValue:algoList[control.selectedSegment].setting.maxInterval];
//        [intervalSlider setIntValue:algoList[control.selectedSegment].setting.interval];
//        [intervalValue setStringValue:[NSString stringWithFormat:@"%d", algoList[control.selectedSegment].setting.interval]];
    }
    
    // advance UI settings
    switch (control.selectedSegment) {
        case SegmentCreativity:
        case SegmentCognitivePreparedness:
        case SegmentAlertness:
//            [intervalButton setEnabled:NO];
//            [bcqThresholdSegment setSelectedSegment:algoList[control.selectedSegment].setting.bcqThreshold];
//            [bcqWindowCombo selectItemAtIndex:(algoList[control.selectedSegment].setting.bcqWindow-30)/5];
//            
//            [bcqThresholdTitle setHidden:NO];
//            [bcqThresholdSegment setHidden:NO];
//            [bcqWindowTitle setHidden:NO];
//            [bcqWindowCombo setHidden:NO];
            break;
        default:
            break;
    }
}

- (IBAction)intervalChange:(id)sender {
}

- (IBAction)intervalSliderChanged:(id)sender {
}

- (void) sendBulkData {
    if ([[NskAlgoSdk sharedInstance] dataStream:NskAlgoDataTypeBulkEEG data:raw_data_em_me length:/*(int32_t)(sizeof(raw_data_em_me)/sizeof(raw_data_em_me[0]))*/(512*(80+5))] == TRUE) {
        [cannedBulkButton setEnabled:NO];
    } else {
        NSAlert *alert = [[NSAlert alloc] init];
        [alert setMessageText:@"Fail to perform bulk data analysis"];
        [alert addButtonWithTitle:@"OK"];
        [alert runModal];
    }
}

- (IBAction)bulkDataPress:(id)sender {
    [self performSelector:@selector(sendBulkData) withObject:nil afterDelay:0];
}

- (IBAction)bcqThresholdChanged:(id)sender {
    if ([segmentControl selectedSegment] != SegmentCreativity &&
        [segmentControl selectedSegment] != SegmentAlertness &&
        [segmentControl selectedSegment] != SegmentCognitivePreparedness) {
        return;
    }
    algoList[[segmentControl selectedSegment]].setting.bcqThreshold = (int)[bcqThresholdSegment selectedSegment];
}

- (IBAction)bcqWindowChanged:(id)sender {
    if ([segmentControl selectedSegment] != SegmentCreativity &&
        [segmentControl selectedSegment] != SegmentAlertness &&
        [segmentControl selectedSegment] != SegmentCognitivePreparedness) {
        return;
    }
    algoList[[segmentControl selectedSegment]].setting.bcqWindow = [[bcqWindowCombo objectValueOfSelectedItem] intValue];
}

- (void)headsetConnection:(BOOL)bConnected {
    if (bConnected) {
        [connectButton setEnabled:NO];
//        [apCheckbox setEnabled:YES];
//        [meCheckbox setEnabled:YES];
//        [me2Checkbox setEnabled:YES];
//        [fCheckbox setEnabled:YES];
//        [f2Checkbox setEnabled:YES];
        [attCheckbox setEnabled:YES];
        [medCheckbox setEnabled:YES];
//        [crCheckbox setEnabled:YES];
//        [alCheckbox setEnabled:YES];
//        [cpCheckbox setEnabled:YES];
        [bpCheckbox setEnabled:YES];
        [eyeBlinkCheckbox setEnabled:YES];
        [setAlgoButton setEnabled:YES];
        [startPauseButton setEnabled:NO];
        [stopButton setEnabled:NO];
        
        [self resetAlgoPlotData];
        [self resetAlgoSettings];
        
//        [intervalValue setStringValue:@"1"];
//        [intervalSlider setIntValue:1];
//        [intervalButton setEnabled:NO];
//        [intervalSlider setEnabled:NO];
    } else {
        [connectButton setEnabled:YES];
        
//        [apCheckbox setEnabled:NO];
//        [meCheckbox setEnabled:NO];
//        [me2Checkbox setEnabled:NO];
//        [fCheckbox setEnabled:NO];
//        [f2Checkbox setEnabled:NO];
        [attCheckbox setEnabled:NO];
        [medCheckbox setEnabled:NO];
//        [crCheckbox setEnabled:NO];
//        [alCheckbox setEnabled:NO];
//        [cpCheckbox setEnabled:NO];
        [bpCheckbox setEnabled:NO];
        [eyeBlinkCheckbox setEnabled:NO];
        [setAlgoButton setEnabled:NO];
        [startPauseButton setEnabled:NO];
        [stopButton setEnabled:NO];
        
        [self resetAlgoPlotData];
        [self removeAlgoPlot];
        [self resetAlgoSettings];
        
        [stateLabel setStringValue:@""];
        [signalLabel setStringValue:@""];
        
//        [intervalValue setStringValue:@"1"];
//        [intervalSlider setIntValue:1];
//        [intervalButton setEnabled:NO];
//        [intervalSlider setEnabled:NO];
        
        ((CPTGraphHostingView*)graphHostView).hostedGraph = nil;
        for (int i=0;i<SegmentEEGRaw;i++) {
            [segmentControl setEnabled:NO forSegment:i];
            [segmentControl setSelected:NO forSegment:i];
        }
        
        [attLevelIndicator setIntValue:0];
        [attValue setStringValue:@""];
        
        [medLevelIndicator setIntValue:0];
        [medValue setStringValue:@""];
    }
}

#pragma mark -
#pragma mark Plot Data Source Methods

-(NSUInteger)numberOfRecordsForPlot:(CPTPlot *)plot
{
    for (int i=0;i<SegmentMax;i++) {
        for (int j=0;j<sizeof(algoList[i].plots.plot)/sizeof(algoList[i].plots.plot[0]);j++) {
            if (algoList[i].plots.plot[j] == plot) {
                return [algoList[i].setting.index[j] count];
            }
        }
    }
    return 0;
}

-(id)numberForPlot:(CPTPlot *)plot field:(NSUInteger)fieldEnum recordIndex:(NSUInteger)index
{
    for (int i=0;i<SegmentMax;i++) {
        for (int j=0;j<sizeof(algoList[i].plots.plot)/sizeof(algoList[i].plots.plot[0]);j++) {
            if (algoList[i].plots.plot[j] == plot) {
                return algoList[i].setting.index[j][index][@(fieldEnum)];
            }
        }
    }
    return nil;
}

#ifndef USE_CANNED_DATA
static long long current_timestamp() {
    struct timeval te;
    gettimeofday(&te, NULL);
    long long milliseconds = te.tv_sec*1000LL + te.tv_usec/1000; // caculate milliseconds
    return milliseconds;
}

int rawCount = 0;
static float *input = nil;
static float *output = nil;
static FFTAccelerate *fftAccel = nil;
static int inputIndex = 0;

#pragma mark
#pragma COMM SDK Delegate

-(void)onDataReceived:(NSInteger)datatype data:(int)data obj:(NSObject *)obj {
    switch (datatype) {
            
        case MindDataType_CODE_POOR_SIGNAL:
            //NSLog(@"POOR_SIGNAL %d\n",data);
        {
            long long timestamp = current_timestamp();
            static long long ltimestamp = 0;
            
            printf("PQ,%lld,%lld,%d\n", timestamp%100000, timestamp - ltimestamp, rawCount);
            ltimestamp = timestamp;
            rawCount = 0;
        }
        {
            int16_t poor_signal[1];
            poor_signal[0] = (int16_t)data;
            [[NskAlgoSdk sharedInstance] dataStream:NskAlgoDataTypePQ data:poor_signal length:1];
        }
            break;
            
        case MindDataType_CODE_RAW: {
            rawCount++;
            
            if (input == nil) {
                input = (float*)malloc(sizeof(float)*INPUT_SIZE);
            }
            if (output == nil) {
                output = (float*)malloc(sizeof(float)*INPUT_SIZE);
            }
            if (fftAccel == nil) {
                fftAccel = new FFTAccelerate(INPUT_SIZE);
            }
            
            input[inputIndex++] = (float)data;
            if (inputIndex == INPUT_SIZE) {
                NSMutableArray *freqIndex = algoList[SegmentFreq].setting.index[0];
                inputIndex = 0;
                fftAccel->doFFTReal(input, output, INPUT_SIZE);
                [freqIndex removeAllObjects];
                for (int li=0;li<X_FREQ_RANGE;li++) {
                    [freqIndex addObject:
                     @{ @(CPTScatterPlotFieldX): @(li),
                        @(CPTScatterPlotFieldY): @((output[li*2]+output[li*2 + 1])/2) }
                     ];
                }
            }
            dispatch_async(dispatch_get_main_queue(), ^{
                [self addValue:@(data) array:algoList[SegmentEEGRaw].setting.index[0]];
            });
            
            if (bRunning == FALSE) {
                return;
            }
        {
            int16_t eeg_data[1];
            eeg_data[0] = (int16_t)data;
            [[NskAlgoSdk sharedInstance] dataStream:NskAlgoDataTypeEEG data:eeg_data length:1];
        }
            //NSLog(@"%@\n CODE_RAW %d\n",[self NowString],data);
            break;
        }
        case MindDataType_CODE_ATTENTION:
        {
            int16_t attention[1];
            attention[0] = (int16_t)data;
            [[NskAlgoSdk sharedInstance] dataStream:NskAlgoDataTypeAtt data:attention length:1];
        }
            //NSLog(@"%@\n CODE_ATTENTION %d\n",[self NowString],data);
            break;
            
        case MindDataType_CODE_MEDITATION:
        {
            int16_t meditation[1];
            meditation[0] = (int16_t)data;
            [[NskAlgoSdk sharedInstance] dataStream:NskAlgoDataTypeMed data:meditation length:1];
        }
            //NSLog(@"%@\n CODE_MEDITATION %d\n",[self NowString],data);
            break;
            
        case MindDataType_CODE_EEGPOWER:
            //NSLog(@"%@\n CODE_EEGPOWER %d\n",[self NowString],data);
            break;
            
        default:
            //NSLog(@"%@\n NO defined data type %ld %d\n",[self NowString],(long)datatype,data);
            break;
    }
}

static NSUInteger checkSum=0;
bool bTGStreamInited = false;

-(void) onChecksumFail:(Byte *)payload length:(NSUInteger)length checksum:(NSInteger)checksum{
    checkSum++;
    
    //NSLog(@"CheckSum lentgh:%lu  CheckSum:%lu",(unsigned long)length,(unsigned long)checksum);
    
    //NSLog(@"CheckSum total: %d",(int)checkSum);
}

static ConnectionStates lastConnectionState = STATE_ERROR;
-(void)onStatesChanged:(ConnectionStates)connectionState{
    NSString *connectState;
    //NSLog(@"%@\n Connection States:%lu\n",[self NowString],(unsigned long)connectionState);
    if (lastConnectionState == connectionState) {
        return;
    }
    lastConnectionState = connectionState;
    switch (connectionState) {
            
        case STATE_CONNECTED:
            connectState=@"1 - STATE_CONNECTED";
            break;
            
        case STATE_WORKING:
            connectState=@"2 - STATE_WORKING";
            break;
            
        case STATE_STOPPED:
            connectState=@"3 - STATE_STOPPED";
            break;
            
        case STATE_DISCONNECTED: {
            connectState=@"4 - STATE_DISCONNECTED";
            dispatch_async(dispatch_get_main_queue(), ^{
                [self headsetConnection:NO];
            });
            break;
        }
        case STATE_COMPLETE:
            connectState=@"5 - STATE_COMPLETE";
            break;
            
        case STATE_RECORDING_START:
            connectState=@"7 - STATE_RECORDING_START";
            break;
            
        case STATE_RECORDING_END:
            connectState=@"8 - STATE_RECORDING_END";
            break;
            
        case STATE_FAILED: {
            connectState=@"100 - STATE_FAILED";
            dispatch_async(dispatch_get_main_queue(), ^{
                [self headsetConnection:NO];
            });
            break;
        }
        case STATE_ERROR: {
            connectState=@"101 - STATE_ERROR";
            dispatch_async(dispatch_get_main_queue(), ^{
                [self headsetConnection:NO];
            });
            break;
        }
        default:
            break;
    }
    
    NSLog(@"Connection States:%@",connectState);

}

-(void) onRecordFail:(RecrodError)flag{
    
    NSString *recordFlag;
    
    switch (flag) {
            
        case RECORD_ERROR_FILE_PATH_NOT_READY:
            recordFlag=@"RECORD_ERROR_FILE_PATH_NOT_READY";
            break;
            
        case RECORD_ERROR_RECORD_IS_ALREADY_WORKING:
            recordFlag=@"RECORD_ERROR_RECORD_IS_ALREADY_WORKING";
            break;
            
        case RECORD_ERROR_RECORD_OPEN_FILE_FAILED:
            recordFlag=@"RECORD_ERROR_RECORD_OPEN_FILE_FAILED";
            break;
            
        case RECORD_ERROR_RECORD_WRITE_FILE_FAILED:
            recordFlag=@"RECORD_ERROR_RECORD_WRITE_FILE_FAILED";
            break;
            
    }
    
    NSLog(@"RecordFail %@",recordFlag);
    
}
#endif

@end
