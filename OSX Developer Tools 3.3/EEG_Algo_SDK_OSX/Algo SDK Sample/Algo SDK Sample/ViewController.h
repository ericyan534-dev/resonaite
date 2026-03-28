//
//  ViewController.h
//  Algo SDK Sample
//
//  Created by Donald on 6/7/15.
//  Copyright (c) 2015 NeuroSky. All rights reserved.
//

#import <Cocoa/Cocoa.h>
#import <AlgoSdk/NskAlgoSdk.h>
#import <CorePlot/CorePlot.h>

#import <TGStreamMac/TGStreamForMac.h>
#import <TGStreamMac/TGStreamDelegate.h>

@interface ViewController : NSViewController <TGStreamDelegate, NskAlgoSdkDelegate, CPTPlotDataSource> {
    IBOutlet id connectButton;
    IBOutlet id stateLabel;
    IBOutlet id signalLabel;
    IBOutlet id apCheckbox;
    IBOutlet id meCheckbox;
    IBOutlet id me2Checkbox;
    IBOutlet id fCheckbox;
    IBOutlet id f2Checkbox;
    IBOutlet id attCheckbox;
    IBOutlet id medCheckbox;
    IBOutlet id eyeBlinkCheckbox;
    IBOutlet id crCheckbox;
    IBOutlet id alCheckbox;
    IBOutlet id cpCheckbox;
    IBOutlet id bpCheckbox;
    IBOutlet id setAlgoButton;
    IBOutlet id intervalButton;
    IBOutlet id intervalSlider;
    IBOutlet id intervalValue;
    IBOutlet id eyeBlinkImage;
    IBOutlet id bcqThresholdTitle;
    IBOutlet id bcqThresholdSegment;
    IBOutlet id bcqWindowCombo;
    IBOutlet id bcqWindowTitle;
    
    IBOutlet id textFieldView;
    
    IBOutlet id cannedBulkButton;
    
    IBOutlet id startPauseButton;
    IBOutlet id stopButton;
    
    IBOutlet id graphHostView;
    
    IBOutlet id attLevelIndicator;
    IBOutlet id attValue;
    
    IBOutlet id medLevelIndicator;
    IBOutlet id medValue;
    
    IBOutlet id segmentControl;
    
    // Bluetooth variables:
    IOBluetoothDevice *mBluetoothDevice;
    IOBluetoothRFCOMMChannel *mRFCOMMChannel;
}

- (IBAction)openConnectionAction:(id)sender;
- (IBAction)setAlgos:(id)sender;
- (IBAction)startPause:(id)sender;
- (IBAction)stop:(id)sender;
- (IBAction)segmentChanged:(id)sender;
- (IBAction)intervalChange:(id)sender;
- (IBAction)intervalSliderChanged:(id)sender;
- (IBAction)bulkDataPress:(id)sender;
- (IBAction)bcqThresholdChanged:(id)sender;
- (IBAction)bcqWindowChanged:(id)sender;

@end

